console.log(JSON.stringify(process.env, null, 4));
var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/pushconsumer'), require('./conf/pushconsumer-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));


const obj = commons.obj(conf);

const logger = obj.logger();
const eh = obj.event_handler();
const utility = obj.utility();

var requestPromise = require('request-promise-native');

var hostname = require('os').hostname();
console.log("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)
logger.info("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)

// definizione dei diversi ambienti di deploy

var env_dynamics = {
    "dev" : "DEV",
    "tst" : "TEST",
    "prod": "PROD"
}

// configurazione per i differenti ambienti di deploy
if(process.env.APPDYNAMICS_HOSTS && process.env.APPDYNAMICS_HOSTS.indexOf(hostname) !== -1){
    require("appdynamics").profile({
        controllerHostName: 'csi-net.saas.appdynamics.com',
        controllerPort: 443,
        controllerSslEnabled: true,
        accountName: 'csi-net',
        accountAccessKey: 'accountAccessKey',
        applicationName: 'NOTIFY_' + env_dynamics[process.env.ENVIRONMENT] + '_CSI-01',
        tierName: 'notify-' + conf.app_name,
        nodeName: 'notify-'+ conf.app_name + '-' + hostname,
        proxyHost: conf.appdynamics.proxyHost,
        proxyPort: conf.appdynamics.proxyPort
    })


}

// Verifica l'invio di un messaggio

function checkPush(payloadMessage) {
    var res = [];

    if (!payloadMessage) {
        res.push("payload not present");
        return res;
    }
    if (typeof payloadMessage !== 'object' || Array.isArray(payloadMessage)) {
        res.push("payload element is not a valid object");
        return res;
    }

    // controllo sui dati obbligatori all'interno
    //    del payload
    if (!payloadMessage.id) res.push("id field is mandatory");
    if (!payloadMessage.user_id) res.push("user_id is mandatory");
    if (!payloadMessage.push) res.push("push is mandatory");
    if( utility.checkNested(payloadMessage,"push.token") && payloadMessage.push.token !== "" && !Array.isArray(payloadMessage.push.token))
        res.push("if push.token is defined, it must be an array of strings");
    if (!utility.checkNested(payloadMessage,"push.title")) res.push("push.title is mandatory");
    if (!utility.checkNested(payloadMessage,"push.body")) res.push("push.body is mandatory");
    return res;
}


function checkTo(payload) {
    return payload.push.token;
}

// Effettua l'invio del messaggio

async function sendPush(body, userPreferences) {

    var message_payload = {
        id : body.payload.id,
        bulk_id : body.payload.bulk_id,
        user_id : body.payload.user_id,
        tag : body.payload.tag,
        correlation_id : body.payload.correlation_id
    };

    await eh.info("trying to send push",JSON.stringify({
        message: message_payload
    }));
    logger.debug("trying to send push");


    var message = body.payload;

    let arrayDestinations = Object.values(userPreferences.body.push);

    var params = {
        "registration_ids": arrayDestinations,
        "notification": {
            "title": message.push.title,
            "body": message.push.body,
            "click_action": message.push.call_to_action
        }
    };

    //logger.debug("push: " ,userPreferences.body.push)

    var options = {
        url: conf.firebase.url,
        headers: {
            "Authorization": "key=" + body.user.preferences.push,
            "Content-Type": "application/json"
        },
        method: 'POST',
        body: params,
        json: true,
        timeout: 2000
    };

    try{
        await requestPromise(options);
        logger.debug("push notification successfully sent");
        await eh.ok("push notification successfully sent",JSON.stringify({
            sender: body.user.preference_service_name,
            message:message
        }));
    }catch(err){
        err.description_message = "firebase error";
        throw err;
    }

}

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
obj.consumer("push", checkPush, checkTo, sendPush)();
