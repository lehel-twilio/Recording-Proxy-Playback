const axios = require('axios');
let AWS = require('aws-sdk');
const S3UploadStream = require('s3-upload-stream');

exports.handler = async function(context, event, callback) {
	Object.keys(event).forEach( thisEvent => console.log(`${thisEvent}: ${event[thisEvent]}`));

    // Set the region
    AWS.config.update({region: 'us-east-1'});
    AWS.config.update({ accessKeyId: context.AWSaccessKeyId, secretAccessKey: context.AWSsecretAccessKey });

    const s3Stream = S3UploadStream(new AWS.S3());

    // call S3 to retrieve upload file to specified bucket
    let upload = s3Stream.upload({Bucket: context.AWSbucket, Key: event.RecordingSid, ContentType: 'audio/x-wav'});

    const recordingUpload = await downloadRecording(event.RecordingUrl, upload);

    let client = context.getTwilioClient();
    let workspace = context.TWILIO_WORKSPACE_SID;

    let taskFilter = `conference.participants.worker == '${event.CallSid}'`;

    //search for the task based on the CallSid attribute
    client.taskrouter.workspaces(workspace)
      .tasks
      .list({evaluateTaskAttributes: taskFilter})
      .then(tasks => {

        let taskSid = tasks[0].sid;
        let attributes = {...JSON.parse(tasks[0].attributes)};
        attributes.conversations.segment_link = `https://your proxy address/?recordingSid=${event.RecordingSid}`;

        //update the segment_link
        client.taskrouter.workspaces(workspace)
          .tasks(taskSid)
          .update({
            attributes: JSON.stringify(attributes)
          })
          .then(task => {
            callback(null, null);
          })
          .catch(error => {
            console.log(error);
            callback(error);
          });

      })
      .catch(error => {
        console.log(error);
        callback(error);
      });
};

async function downloadRecording (url, upload) {

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })

  response.data.pipe(upload);

  return new Promise((resolve, reject) => {
    upload.on('uploaded', resolve)
    upload.on('error', reject)
  })
}
