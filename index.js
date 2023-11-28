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
// const run = async () => {
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

    // Download GitHub repo as a zip file
    const zipFile = await downloadGitHubRepo(email, githubRepoUrl);

    // Upload zip file to Google Cloud Storage
    const googleStorageUrl = await uploadToGoogleStorage(bucket, storage, zipFile, email);

    // Send email through SES
    const emailSent = await sendEmail(email, sourceEmail, 'Submission Successful', 'Your submission was successful.');
    
    const saveToDyanmo = await saveToDynamoDB(dynamoDB, email, googleStorageUrl, emailSent);

    return {
      statusCode: 200,
      body: JSON.stringify('Success'),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('Error'),
    };
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

const saveToDynamoDB = async(dynamoDB, email, githubRepoUrl, emailSent) => {
  return new Promise(async (resolve, reject) => {
    try {
      let date = new Date().toISOString();
      console.log('emailSent: ', emailSent);
      const params = {
        TableName: dynamoDB,
        Item: {
          Email: email,
          URL: githubRepoUrl,
          EmailSentTime: date,
        },
      };
      
      const data = await dynamodb.put(params).promise();
      console.log('saved data to dynamo db');
      resolve(data);
    } catch (error) {
      console.error('Error saving data to DynamoDB:', error);
      reject(error);
    }
  });
}
