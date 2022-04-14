/* eslint-disable multiline-ternary */
const { default: axios } = require("axios");
const { MessageEmbed } = require("discord.js");
const { sendErrorToLogChannel, isValidHttpUrl, toValue } = require("../utils");

const trackTrades = (bot) => {
  const salesSentToDiscordChannel = [];

  setInterval(async () => {
    try {
      const res = await axios.get(
        `${process.env.MORALIS_NFT_URL}/${process.env.NFT_CONTRACT_ADDRESS}/transfers?chain=${process.env.NFT_CHAIN}&format=decimal&limit=50`,
        {
          headers: {
            "x-api-key": process.env.MORALIS_WEB3_API_KEY,
          },
        }
      );
      const transactions = res.data?.result?.sort(
        (a, b) =>
          Date.parse(a?.block_timestamp) - Date.parse(b?.block_timestamp)
      );

      for (let i = 0; i < transactions.length; i++) {
        try {
          const tokenId = res.data?.result[i]?.token_id;
          const value = Number(res.data?.result[i]?.value);
          const transactionTime = new Date(
            res.data?.result[i]?.block_timestamp
          );
          const transHash = res.data?.result[i]?.transaction_hash;
          const transactionUrl = `${process.env.TRANSACTION_EXPLORER_URL}${transHash}`;

          if (
            tokenId &&
            value > 0 &&
            !salesSentToDiscordChannel.includes(transHash)
          ) {
            const metadata = await axios.get(
              `${process.env.MORALIS_NFT_URL}/${process.env.NFT_CONTRACT_ADDRESS}/${tokenId}?chain=${process.env.NFT_CHAIN}&format=decimal`,
              {
                headers: {
                  "x-api-key": process.env.MORALIS_WEB3_API_KEY,
                },
              }
            );
            let tradeBefore = await axios.get(
              `${process.env.MORALIS_NFT_URL}/${process.env.NFT_CONTRACT_ADDRESS}/${tokenId}/transfers?chain=${process.env.NFT_CHAIN}&format=decimal&limit=50`,
              {
                headers: {
                  "x-api-key": process.env.MORALIS_WEB3_API_KEY,
                },
              }
            );
            tradeBefore = tradeBefore.data?.result
              ?.filter((trans) => Number(trans.value) > 0)
              .sort(
                (a, b) =>
                  Date.parse(a?.block_timestamp) -
                  Date.parse(b?.block_timestamp)
              )[0];

            const meta = JSON.parse(metadata?.data?.metadata);
            const imageUrl = meta?.image;
            const tradedValue = toValue(res.data?.result[i]?.value);
            const lastTradeValue = toValue(tradeBefore?.value);
            const buyer = res.data?.result[i]?.from_address;
            const seller = res.data?.result[i]?.to_address;
            const rarity = meta?.attributes
              ? meta.attributes[meta.attributes.length - 1]?.value
              : undefined;

            const tradesChannel = await bot?.channels?.cache?.get(
              process.env.DISCORD_TRADES_CHANNEL_ID
            );

            let delta = "";
            if (!isNaN(lastTradeValue) && lastTradeValue > 0) {
              delta = (tradedValue - lastTradeValue).toFixed(2);
              if (delta < 0) {
                delta = `${delta} 📜✋`;
              } else {
                delta = `${delta} 🚀`;
              }
            }

            if (
              tradesChannel &&
              tradedValue > 0 &&
              isValidHttpUrl(imageUrl) &&
              rarity &&
              buyer &&
              seller &&
              transactionTime
            ) {
              let messageEmbed = "";

              if (tradeBefore && delta) {
                messageEmbed = new MessageEmbed()
                  .setColor(`#${process.env.DISCORD_BOT_COLOR}`)
                  .setTitle("Trade")
                  .setURL(transactionUrl)
                  .addFields(
                    {
                      name: "Today's Sale",
                      value: `${tradedValue} ${process.env.COIN_NAME}`,
                      inline: true,
                    },
                    {
                      name: "Previous Sale",
                      value: `${lastTradeValue} ${process.env.COIN_NAME}`,
                      inline: true,
                    },
                    { name: "Delta", value: delta, inline: true },
                    { name: "\u200B", value: "\u200B" },
                    { name: "Buyer", value: buyer, inline: true },
                    {
                      name: "Seller",
                      value: seller,
                      inline: true,
                    }
                  )
                  .addField("Rarity", rarity, true)
                  .setImage(imageUrl)
                  .setTimestamp(transactionTime);
              } else {
                messageEmbed = new MessageEmbed()
                  .setColor(`#${process.env.DISCORD_BOT_COLOR}`)
                  .setTitle("Trade")
                  .setURL(transactionUrl)
                  .addFields(
                    {
                      name: "Sale Value",
                      value: `${tradedValue} ${process.env.COIN_NAME}`,
                    },
                    { name: "Buyer", value: buyer },
                    {
                      name: "Seller",
                      value: seller,
                    }
                  )
                  .addField("Rarity", rarity, true)
                  .setImage(imageUrl)
                  .setTimestamp(transactionTime);
              }

              tradesChannel.send({ embeds: [messageEmbed] });
              salesSentToDiscordChannel.push(transHash);
            }
          }
        } catch (e) {
          sendErrorToLogChannel(bot, `error at getting trades`, e);
        }
      }
    } catch (e) {
      sendErrorToLogChannel(bot, `error at getting transactions of trades`, e);
    }
  }, 5000);
};

module.exports = trackTrades;