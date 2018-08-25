const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { forEachSeries } = require('p-iteration');

const SOURCE_URL = 'https://www.liburnasional.com/';
const INDO_OFFSET_GMT = 7;

const normalizeIndoTime = (date) => {
  const diffHoursGMT = (-date.getTimezoneOffset() / 60) - INDO_OFFSET_GMT;
  date.setHours(diffHoursGMT, 0, 0, 0);
  return date;
};

const getAllCalendarLinks = async () => {
  const { data: html } = await axios.get(`${SOURCE_URL}`);
  const $ = cheerio.load(html);

  const $availableYears = $('[id^=libnas-linkid-menu-nationalholiday-]');

  return Array.from($availableYears).map(el => $(el).attr('href'));
};

(async () => {
  const calLinks = await getAllCalendarLinks();

  forEachSeries(calLinks, async (link) => {
    const { data: html } = await axios.get(`${SOURCE_URL}${link}`);
    const $ = cheerio.load(html);
    const holidayElements = Array.from(
      $('.libnas-calendar-holiday-title'),
    );

    const holidays = holidayElements.reduce((res, el) => {
      const $el = $(el);
      const $time = $el.find('time');

      const dateTime = normalizeIndoTime((new Date($time.attr('datetime'))));
      const dateStr = $time.text();

      const event = $el.find('a').text();

      res[dateTime.toUTCString()] = { event, dateStr };
      return res;
    }, {});

    const year = link.split('-')[1].slice(0, -1);

    fs.writeFileSync(`${__dirname}/${year}.json`, JSON.stringify(holidays, null, 2), (err) => {
      if (err) throw err;
    });
  });
})();
