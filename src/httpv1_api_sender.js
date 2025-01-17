const axios = require('axios');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];


module.exports = function(conf, logger) {

  const FIREBASE_URL = conf.firebase.httpv1_api_url;

  /**
   * Get a valid access token.
   * @param {object} key firebase project service account file
   * @returns the authorization request response
   */
  async function getAccessToken(key) {

    try {
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        SCOPES,
        null
      );
      return await jwtClient.authorize();
      
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  /**
   * Send HTTP request to FCM with given message.
   *
   * @param {string} projectId firebase project id
   * @param {string} token oauth2 access token
   * @param {object} message the message to send
   * @param {array} devices the device registration id
   * @returns firebase send message response
   */
  async function sendFcmMessage(projectId, token, message, devices) {

    try {
      return await axios({
        method: 'post',
        url: FIREBASE_URL.replace(":project_id", projectId),
        data: buildFcmMessage(message, devices[0]),
        headers: {
          'Authorization': 'Bearer ' + token
        },
        responseType: 'json',
      });
    } catch (error) {
      if(error.response && (error.response.status === 404 || error.response.status === 403)) {
        error.type = "client_error";
        error.level = "debug";
      }
      //logger.error('Unable to send message to Firebase', error);
      throw error;
    }
  }

  /**
   * Create FCM message 
   * @param {object} message the message to send
   * @param {string} device the device id
   * @returns the FCM message object
   */
  function buildFcmMessage(message, device) {
    return {
      'message': {
        'token': device,
        'notification': {
          'title': message.title,
          'body': message.body
        }
      }
    };
  }

  return {
    getAccessToken: getAccessToken,
    sendFcmMessage: sendFcmMessage
  }
}
