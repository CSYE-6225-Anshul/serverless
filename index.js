const AWS = require('aws-sdk');
const dotenv = require('dotenv').config();
AWS.config.update({ region: process.env.REGION });
const sns = new AWS.SNS();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();
const fs = require('fs');
const download = require('download');
const path = require('path');
const gitUrlParse = require('git-url-parse');
const { Storage } = require('@google-cloud/storage');

exports.handler = async (event, context) => {
  console.log('Lambda function invoked');
  const bucket = process.env.BUCKET_NAME;
  const dynamoDB = process.env.DYNAMODB_TABLE;
  const sourceEmail =  process.env.SOURCE_EMAIL;

  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS;
  const credentialsJSON = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
  const storage = new Storage({
    credentials: JSON.parse(credentialsJSON),
    projectId: process.env.GOOGLE_PROJECT_ID
  });

  console.log('BUCKET_NAME:', process.env.BUCKET_NAME);
  console.log('DYNAMODB_TABLE:', process.env.DYNAMODB_TABLE);
  console.log('SOURCE_EMAIL:', process.env.SOURCE_EMAIL);
  console.log('REGION:', process.env.REGION);

  try {
    // Parse SNS message
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const email = snsMessage.email;
    const githubRepoUrl = snsMessage.url;
    const emailDetails = {
      email: email,
      submissionURL: githubRepoUrl,
      gcsURL: '',
      emailSentTime: '',
      assignmentId: snsMessage.assignmentId,
      accountId: snsMessage.accountId,
      status: ''
    };

    // Download GitHub repo as a zip file
    const zipFile = await downloadGitHubRepo(email, githubRepoUrl);

    // Upload zip file to Google Cloud Storage
    let googleStorageUrl;
    let emailSent;

    try {
      googleStorageUrl = await uploadToGoogleStorage(bucket, storage, zipFile, email);
      // If successfully uploaded, send success email
      emailDetails.status = 'success';
      emailDetails.gcsURL = googleStorageUrl;
      emailSent = await sendEmail(email, sourceEmail, 'Submission Successful', 'Your submission was successful.');
    } catch (uploadError) {
      // If upload fails, send error email
      emailDetails.status = 'falied';
      emailSent = await sendEmail(email, sourceEmail, 'Error Uploading to Google Cloud Storage', `Error: ${uploadError}`);
      throw uploadError; // Re-throw the error to propagate it further
    }

    // Save data to DynamoDB only if the email was sent successfully
    if (emailSent) {
      const saveToDyanmo = await saveToDynamoDB(dynamoDB, emailDetails);
    }
    return `Successfully processed ${githubRepoUrl} for ${email}`;
  } catch (error) {
    console.error('Error:', error);
    throw error; // Re-throw the error to propagate it further
  }
};

const downloadGitHubRepo = async(email, githubRepoUrl) => {
  try {
    const tempDir = '/tmp';
    const url = githubRepoUrl;
    const zipURL = url + '/archive/main.zip';
    const parsedUrl = gitUrlParse(url);

    // Extract repository name
    const repositoryName = parsedUrl.name;
    await download(zipURL, tempDir);

    const zipFileName = repositoryName + '-main.zip';
    const zipFilePath = path.join(tempDir, zipFileName);  
    console.log('Downloaded GitHub repo:', zipFilePath);
    return zipFilePath;
  } catch (error) {
    console.error('Error downloading GitHub repo:', error);
    throw error; // Re-throw the error to propagate it further
  }
}

const uploadToGoogleStorage = async(bucketName, storage, filePath, email) => {
  try {
    const bucket = storage.bucket(bucketName);
    const currentDateTime = new Date().toISOString().replace(/:/g, '-');
    const destinationFileName = `${email}_${currentDateTime}.zip`;

    // Use the upload method to directly upload the file
    await bucket.upload(filePath, {
      destination: destinationFileName,
      metadata: {
        contentType: 'application/zip', // Set the content type based on your file type
      },
    });

    console.log('Upload to Google Cloud Storage finished');
    return `gs://${bucketName}/${destinationFileName}`;
  } catch (error) {
    console.error('Error uploading to Google Cloud Storage:', error);
    return error;
  }
}

const sendEmail = async(toEmail, sourceEmail, subject, message) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Sending email', toEmail, sourceEmail, subject, message);
      const params = {
        Destination: {
          ToAddresses: ['anshuls1610@gmail.com'],
        },
        Message: {
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: message,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: subject,
          },
        },
        Source: sourceEmail,
      };
      
      const result = await ses.sendEmail(params).promise();
      console.log('Email sent successfully:', result);
      resolve(result);
    } catch (error) {
      console.error('Error sending email:', error);
      reject(error);
    }
  });
}

const saveToDynamoDB = async(dynamoDB, emailDetails) => {
  return new Promise(async (resolve, reject) => {
    try {
      let date = new Date().toISOString();
      console.log('Saving in dynamo db', emailDetails);
      emailDetails.emailSent = date;
      const params = {
        TableName: dynamoDB,
        Item: emailDetails,
      };
      
      const data = await dynamodb.put(params).promise();
      console.log('Saved to dynamo db', params);
      resolve(data);
    } catch (error) {
      console.error('Error saving data to DynamoDB:', error);
      reject(error);
    }
  });
}
