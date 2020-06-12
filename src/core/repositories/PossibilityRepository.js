  /**
   * Get the requested possibility
   * @param {number|String} eventId
   * @param {String} emoji
   * @param {Number} id
   * @return {Promise<Possibility>}
   */
  async getByEventIdAndEmojiAndId(eventId, emoji, id) {
    return new Possibility(
        Object.assign({eventId: eventId, emoji: emoji, id: id},
            this.events[eventId].possibilities[emoji][id]));
  }

  /**
   * Get randomly a possibility
   * @param {number|String} eventId
   * @param {String} emoji
   * @return {Promise<Possibility>}
   */
  async getRandomByIdAndEmoji(eventId, emoji) {
    const id = Math.round(
        Math.random() * (this.events[eventId].possibilities[emoji].length - 1));
    return new Possibility(
        Object.assign({eventId: eventId, emoji: emoji, id: id},
            this.events[eventId].possibilities[emoji][id]));
  }
