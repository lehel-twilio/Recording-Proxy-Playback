const express     = require('express');
const app         = express();
const fs          = require('fs');
const aws         = require('aws-sdk');
const downloader  = require('s3-download-stream');
require('dotenv').config();
require('log-timestamp');

aws.config.update({ region: 'us-east-1' });
aws.config.update({ accessKeyId: process.env.accessKeyId, secretAccessKey: process.env.secretAccessKey });

const s3 = new aws.S3({apiVersion: '2006-03-01'});

app.listen(8080, function() {
  console.log("[NodeJS] Application Listening on Port 8080");
});

app.get('/', function(req, res) {

    const recordingSid = req.query.recordingSid;

    console.log('Received playback request');
    console.log(recordingSid);

    let range = req.headers.range;
    console.log(range);

    let config = {
      client: s3,
      concurrency: 6,
      params: {
        Key: recordingSid,
        Bucket: process.env.bucket
      }
    }

    if (range !== undefined || range !== 'bytes=0-') {
      config.params.Range = range;
    }

    s3.headObject(config.params, (error, data) => {
      if (error) {
        console.log(error);
      }

      console.log(data);

      if (range !== undefined) {

        let contentRange = data.ContentRange;
        if (range === 'bytes=0-') {
          contentRange = `bytes 0-${data.ContentLength - 1}/${data.ContentLength}`;
          config.params.Range = `bytes=0-${data.ContentLength - 1}`;
        }

        res.status(206).header({
          'Accept-Ranges': data.AcceptRanges,
          'Content-Type': 'audio/x-wav',
          'Content-Length': data.ContentLength,
          'Content-Range': contentRange
        });
      } else {
        res.header({
          'Accept-Ranges': data.AcceptRanges,
          'Content-Type': 'audio/x-wav',
          'Content-Length': data.ContentLength
        });
      }

      downloader(config).pipe(res);
    })
});
