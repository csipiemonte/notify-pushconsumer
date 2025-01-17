var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/pushconsumer'), require('./conf/pushconsumer-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const logger = obj.logger();
const eh = obj.event_handler();
const utility = obj.utility();
const legacySender = require("./legacy_api_sender")(conf, logger);
const httpv1Sender = require("./httpv1_api_sender")(conf, logger);

var httpv1AccessTokensCache = {};

// verifica del messaggio da inviare
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

// effettua l'invio del messaggio
async function sendPush(body, userPreferences) {
    try {
        var messagePayload = {
            id : body.payload.id,
            bulk_id : body.payload.bulk_id,
            user_id : body.payload.user_id,
            tag : body.payload.tag,
            correlation_id : body.payload.correlation_id,
            tenant : body.user.tenant ? body.user.tenant : conf.defaulttenant
        };

        eh.info("trying to send push",JSON.stringify({
            message: messagePayload
        }));
        logger.debug("trying to send push");

        var message = body.payload;

        let arrayDestinations = Object.values(userPreferences.body.push);

        let serviceConf = null;
        try {
            serviceConf = JSON.parse(body.user.preferences.push);
        } catch (error) {
            serviceConf = body.user.preferences.push;
        }
        logger.debug("Service conf:", serviceConf);

        if(typeof serviceConf === "string" ) {
            // call legacy APIs
            let firebaseResponse = await legacySender.sendFcmMessage(serviceConf, message.push, arrayDestinations);
            logger.debug("Firebase response: status [%s], data [%s]", firebaseResponse.status, JSON.stringify(firebaseResponse.data, null, 2));
        } else {
            // call http v1 APIs
            let tokens = null;
            if(httpv1AccessTokensCache[body.user.preference_service_name] && 
                !isAccessTokenExpired(httpv1AccessTokensCache[body.user.preference_service_name].expiry_date)) {
                 tokens = httpv1AccessTokensCache[body.user.preference_service_name];
                 logger.debug("Got access token from cache");
            } else {
                tokens = await httpv1Sender.getAccessToken(serviceConf);    
                httpv1AccessTokensCache[body.user.preference_service_name] = tokens;
            }
            logger.debug("FCM access tokens:", tokens);
            logger.debug(new Date(tokens.expiry_date).toISOString());
            let firebaseResponse = await httpv1Sender.sendFcmMessage(serviceConf.project_id, tokens.access_token, message.push, arrayDestinations);
            logger.debug("Firebase response: status [%s], data [%s]", firebaseResponse.status, JSON.stringify(firebaseResponse.data, null, 2));
        }
    
        eh.ok("push notification successfully sent", JSON.stringify({
            sender: body.user.preference_service_name,
            message: messagePayload
        }));
        logger.debug("push notification successfully sent");
    } catch(err) {
        err.description_message = "firebase error";
        err.client_source = "pushconsumer";
        throw err;
    }
}

function isAccessTokenExpired(time) {
    let now = new Date().getTime();
    logger.debug("now [%s] expiry_date [%s]", now, time);
    return (time <= now);
}

logger.info("environment:", JSON.stringify(process.env, null, 4));
logger.info("configuration:", JSON.stringify(conf, null, 4));
obj.consumer("push", checkPush, checkTo, sendPush)();
