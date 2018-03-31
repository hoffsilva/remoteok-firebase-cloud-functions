const functions = require('firebase-functions');
const admin = require('firebase-admin');
var request = require('request');
var cheerio = require('cheerio');

admin.initializeApp(functions.config().firebase);

const ONE_HOUR = 3600000;

const URL_THE_REMOTE_OK = "https://remoteok.io/";

var responseData = {date: new Date(Date.now()).toISOString(), items: []};

exports.fetchJobs = functions.https.onRequest(function (req, res) {

    var path = req.query.path.replace(" ", "-");

    const query = path + ".json";

    const lastEdition = admin.database().ref('/remoteok/jobs/' + req.query.path);
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {

                request(URL_THE_REMOTE_OK + query, function (error, resp, data) {

                    if (!error) {

                        return response(res, cleanUp(lastEdition, data), 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        })
});


exports.getJobs = functions.https.onRequest(function (req, res) {

    var path = req.query.path.replace(" ", "-");

    const lastEdition = admin.database().ref('/remoteok/new/jobs/' + req.query.path);
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {

                request("https://remoteok.io/" + path, function (error, resp, html) {

                    if (!error) {

                        var jobs = [];
                        var $ = cheerio.load(html);
                        $('.job').each(function (i, elem) {

                            if (i < 30) {

                                var job = {};

                                job.id = $(this).attr('data-id');
                                job.epoch = $(this).children().eq(5).text();
                                job.date = $(this).children().eq(5).text();
                                job.position = $(this).children().eq(1).children().eq(0).text();
                                job.logo = $(this).children().eq(0).children().eq(0).children().eq(0).attr('src');
                                job.logo = (job.logo == undefined) ? "" : job.logo;
                                job.company = $(this).attr('data-company');
                                job.url = "https://remoteok.io/jobs/" + job.id;
                                job.url_apply = $(this).children().eq(6).find('a').attr('href');

                                job.tags = [];
                                $(this).children().eq(3).each(function () {
                                    $(this).children().each(function () {
                                        job.tags.push($(this).text())
                                    });
                                });


                                $('.expand').each(function (j, elem) {
                                    if (j <= i) {
                                        if ($(this).attr('data-id') === job.id) {
                                            job.description = $(this).children().eq(0).children().eq(0).children().eq(0).html();
                                            if (job.description.length > 0) {
                                                job.description = job.description.substr(0, job.description.indexOf("<div class=\"share no-tweet\">"));
                                            }
                                        }
                                    }
                                });


                                jobs.push(job);
                            }
                        });

                        save(lastEdition, jobs);

                        responseData.date = new Date(Date.now()).toISOString();
                        responseData.items = jobs;

                        return response(res, responseData, 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        })
});


function save(databaseRef, items) {

    var date = new Date(Date.now()).toISOString();

    return databaseRef
        .set({
            date: date,
            items: items
        })
        .then(function () {
            return Promise.resolve({
                date: date,
                items: items
            });
        })
}

function response(res, items, code) {
    return Promise.resolve(res.status(code)
        .type('application/json')
        .send(items))
}

function isCacheValid(snapshot) {
    return (
        snapshot.exists() &&
        elapsed(snapshot.val().date) < ONE_HOUR * 4
    )
}

function isCacheCompaniesValid(snapshot) {
    return (
        snapshot.exists() &&
        elapsed(snapshot.val().date) < ONE_HOUR * 72
    )
}

function elapsed(date) {
    var then = new Date(date);
    var now = new Date(Date.now());
    return now.getTime() - then.getTime()
}

function cleanUp(lastEdition, data) {

    data = JSON.parse(data);
    var items = [];

    if (data != null && data !== undefined && data.length > 0) {

        for (var i = 0; i < data.length; i++) {

            if (i < 30) {
                var item = {
                    id: data[i].id,
                    epoch: data[i].epoch,
                    date: data[i].date,
                    position: data[i].position,
                    tags: data[i].tags,
                    logo: data[i].logo,
                    description: data[i].description,
                    company: data[i].company,
                    url: data[i].url
                };

                items.push(item);
            }
        }

        save(lastEdition, items);
    }

    responseData.date = new Date(Date.now()).toISOString();
    responseData.items = items;

    return responseData;
}

exports.highestPaid = functions.https.onRequest(function (req, res) {

    var url = 'https://remoteok.io/highest-paid-remote-jobs';

    const lastEdition = admin.database().ref('/remoteok/highest-paid/');
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {


                request(url, function (error, resp, html) {
                    if (!error) {

                        var jobs = [];
                        var $ = cheerio.load(html);
                        $('.job').each(function (i, elem) {
                            if (i < 30) {
                                var job = {};
                                job.order = $(this).children().eq(0).text();
                                job.tags = $(this).children().eq(1).text();
                                job.salary = $(this).children().eq(2).text();
                                job.deviation = $(this).children().eq(3).text();
                                job.amount = $(this).children().eq(4).text();

                                jobs.push(job);
                            }
                        });

                        save(lastEdition, jobs);

                        responseData.date = new Date(Date.now()).toISOString();
                        responseData.items = jobs;

                        return response(res, responseData, 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        });

});

exports.getCompanies = functions.https.onRequest(function (req, res) {

    var url = 'https://remoteok.io/remote-companies';

    const lastEdition = admin.database().ref('/remoteok/companies/');
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheCompaniesValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {

                request(url, function (error, resp, html) {
                    if (!error) {

                        var companies = [];
                        var $ = cheerio.load(html);
                        $('.job').each(function (i, elem) {

                            if (i < 30) {
                                var company = {};
                                company.rank = $(this).children().eq(0).text();
                                company.image = $(this).children().eq(1).find('div').attr('src');

                                if (company.image === undefined) {
                                    company.image = "";
                                }

                                company.company = $(this).children().eq(2).text();

                                company.tags = [];

                                $(this).children().eq(3).each(function () {
                                    $(this).children().each(function () {
                                        company.tags.push($(this).text());
                                    });
                                });

                                company.aggregateRating = $(this).children().eq(4).text();

                                companies.push(company);
                            }
                        });

                        save(lastEdition, companies);

                        responseData.date = new Date(Date.now()).toISOString();
                        responseData.items = companies;

                        return response(res, responseData, 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        });
});

exports.getCompanyJobs = functions.https.onRequest(function (req, res) {

    var path = req.query.company.replace(" ", "-");

    var url = 'https://remoteok.io/remote-companies/' + path.toLowerCase();

    const lastEdition = admin.database().ref('/remoteok/companies/jobs');
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheCompaniesValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {

                request(url, function (error, resp, html) {
                    if (!error) {

                        var jobs = [];
                        var $ = cheerio.load(html);
                        $('.job').each(function (i, elem) {

                            if (i < 30) {

                                var job = {};

                                job.id = $(this).attr('data-id');
                                job.epoch = $(this).children().eq(5).text();
                                job.date = $(this).children().eq(5).text();
                                job.position = $(this).children().eq(1).children().eq(0).text();
                                job.logo = $(this).children().eq(0).find('div').attr('src');
                                job.description = $(this).children().eq(1).children().eq(0).text();
                                job.company = req.query.company;
                                job.url = "https://remoteok.io/jobs/" + job.id;

                                job.tags = [];
                                $(this).children().eq(3).each(function () {
                                    $(this).children().each(function () {
                                        job.tags.push($(this).text())
                                    });
                                });

                                jobs.push(job);
                            }
                        });

                        save(lastEdition, jobs);

                        responseData.date = new Date(Date.now()).toISOString();
                        responseData.items = jobs;

                        return response(res, responseData, 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        });
});

exports.getStatistics = functions.https.onRequest(function (req, res) {

    var url = 'https://remoteok.io/remote-work-statistics';

    const lastEdition = admin.database().ref('/remoteok/statistics/');
    return lastEdition
        .once('value')
        .then(function (snapshot) {
            if (isCacheValid(snapshot)) {
                return response(res, snapshot.val(), 200)
            } else {

                request(url, function (error, resp, html) {
                    if (!error) {

                        var statistics = [];
                        var $ = cheerio.load(html);
                        $('tr').each(function (i, elem) {

                            if (i < 30) {
                                var statistic = {};

                                if ($(this).children().eq(0).text().length < 15 &&
                                    $(this).children().eq(1).text().length < 15) {
                                    statistic.tag = $(this).children().eq(0).text();
                                    statistic.count = $(this).children().eq(1).text();
                                    statistic.percent = $(this).children().eq(2).text();

                                    statistics.push(statistic);
                                }
                            }
                        });

                        save(lastEdition, statistics);

                        responseData.date = new Date(Date.now()).toISOString();
                        responseData.items = statistics;

                        return response(res, responseData, 200)

                    } else {
                        return response(res, responseData, 200)
                    }
                });
            }
        });
});