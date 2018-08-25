const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { forEachSeries } = require('p-iteration');

const SOURCE_URL = 'https://publicholidays.co.id/id';
const INDO_OFFSET_GMT = 7;

const MONTH_ID_MAPPING = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const toIndoTimezone = (date) => {
  date.setUTCHours(date.getUTCHours() - INDO_OFFSET_GMT);
  return date;
};

const getAllCalendarLinks = async () => {
  const { data: html } = await axios.get(`${SOURCE_URL}`);
  const $ = cheerio.load(html);

  const $availableYears = $(`#nav-menu a[href^="${SOURCE_URL}"]`);

  return Array.from($availableYears).map(el => $(el).attr('href'));
};

(async () => {
  const calLinks = await getAllCalendarLinks();

  forEachSeries(calLinks, async (link) => {
    const year = link.split('-')[0].split('/').reverse()[0];
    const { data: html } = await axios.get(link);

    const $ = cheerio.load(html);

    const holidayElements = Array.from(
      $('table.publicholidays tr[class]'),
    );

    const holidays = holidayElements.reduce((res, el) => {
      const $el = $(el);
      const [dateEl,, summaryParentEl] = Array.from($el.find('td'));

      const event = $(summaryParentEl).text().trim();

      const date = $(dateEl).text();
      const [start, end] = date.split(' to ');

      const startSplitted = start.split(' ');
      const mm = `0${MONTH_ID_MAPPING.indexOf(startSplitted[1]) + 1}`.slice(-2);
      const dd = `0${startSplitted[0]}`.slice(-2);
      const startDate = toIndoTimezone(new Date(
        `${year}-${mm}-${dd}`,
      ));

      // console.log(startDate.toUTCString(), 'utc', year, startSplitted);

      Object.assign(res, {
        [startDate.toUTCString()]: { event },
      });

      if (end) {
        const endSplitted = end.split(' ');
        const emm = `0${MONTH_ID_MAPPING.indexOf(endSplitted[1]) + 1}`.slice(-2);
        const edd = `0${endSplitted[0]}`.slice(-2);
        const endDate = toIndoTimezone(new Date(
          `${year}-${emm}-${edd}`,
        ));

        const dateDiffInDay = (endDate - startDate) / (1000 * 60 * 60 * 24);

        for (let i = 0; i < dateDiffInDay; i += 1) {
          startDate.setHours(24);
          Object.assign(res, {
            [startDate.toUTCString()]: { event },
          });
        }
      }

      return res;
    }, {});

    fs.writeFileSync(`${__dirname}/${year}.json`, JSON.stringify(holidays, null, 2), (err) => {
      if (err) throw err;
    });
  });
})();
