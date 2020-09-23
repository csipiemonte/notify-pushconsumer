var googleAuth = require('google-auth-library');
var util = require('util');

module.exports = function(key,firebase_url) {

    var _projectId = key.project_id;
    // JWT token
    var _jwtClient = new googleAuth.JWT(
        key.client_email,
        null,
        key.private_key,
        ['https://www.googleapis.com/auth/firebase.messaging'],
        null
    );


    // inizializzazione
    var _init = function() {
        return new Promise(function(resolve, reject) {
            _jwtClient.authorize(function(error, tokens) {
                if (error) {
                    // mancata autorizzazione
                    error = util.inspect(error);
                    reject(error);
                    return;
                }
                //console.log("tokens:",JSON.stringify(tokens,null,4))
                resolve();
            });
        });
    };

    // aggiornamento del token di accesso
    function refreshToken(){
        return new Promise(function (resolve, reject) {
            _jwtClient.refreshToken().then(result => {
                //console.log("tokens:",JSON.stringify(result.tokens,null,4))
                resolve(result.tokens)
            }).catch(error => reject(error));
        })

    }

    // invio del messaggio
    var _sendMessage = function(message) {

        //console.log("sending message")
        return _jwtClient.request({
            method: 'post',
            url: firebase_url.replace(":project_id",_projectId),
            data: message
        });
    }


    return {
        init: _init,
        sendMessage: _sendMessage,
        refreshToken: refreshToken
    }
}
