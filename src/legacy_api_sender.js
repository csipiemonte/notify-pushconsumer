const axios = require('axios');

module.exports = function(conf, logger) {

  const FIREBASE_URL = conf.firebase.legacy_api_url;

  /**
   * Send a push message
   * @param {string} token project server key
   * @param {object} message the message content to send
   * @param {Array} devices the devices ids
   * @returns firebase send message response
   */
  async function sendFcmMessage(token, message, devices) {
    try {
      return await axios({
        method: 'post',
        url: FIREBASE_URL,
        data: buildFcmMessage(message, devices),
        headers: {
          "Authorization": "key=" + token,
          "Content-Type": "application/json"
        },
        responseType: 'json',
      });
    } catch (error) {
      logger.error('Unable to send message to Firebase');
      logger.error(error);
      throw error;
    }
  }

  /**
   * Build FCM message
   * @param {object} message the message to send
   * @param {Array} devices the device ids
   * @returns the FCM message
   */
  function buildFcmMessage(message, devices) {
    return {
      "registration_ids": devices,
      "notification": {
          "title": message.title,
          "body": message.body,
          "click_action": message.call_to_action
      }
    };
  }

  return {
    sendFcmMessage: sendFcmMessage
  }

}