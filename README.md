# Lambda Function for GitHub Repo Processing

This Lambda function is designed to process GitHub repository submissions triggered by an Amazon Simple Notification Service (SNS) event. It performs the following tasks:

## Tasks

1. **Download GitHub Repository:**
   - Downloads a GitHub repository in the form of a zip file.
   - Validates the GitHub repository URL to ensure it is a link to a zip file.

2. **Upload to Google Cloud Storage:**
   - Uploads the downloaded zip file to Google Cloud Storage (GCS).
   - Generates a unique destination file name based on the user's email and the current date and time.
   - Provides GCS URLs for both authenticated access and utility access.

3. **Send Email Notification:**
   - Sends email notifications to the user indicating the success or failure of the submission.
   - Includes GCS URLs in the success email.

4. **Save Email Details to DynamoDB:**
   - Saves details about the email, such as email ID, submission time, GCS URLs, and status, to DynamoDB.

## Environment Variables

Ensure that the Lambda function has the following environment variables configured:

- `BUCKET_NAME`: The name of the Google Cloud Storage bucket.
- `DYNAMODB_TABLE`: The name of the DynamoDB table for storing email details.
- `SOURCE_EMAIL`: The source email address for sending notifications.
- `REGION`: The AWS region.
- `GOOGLE_CREDENTIALS`: Base64-encoded JSON credentials for Google Cloud Storage.
- `GOOGLE_PROJECT_ID`: The Google Cloud project ID.

## Dependencies

- **AWS SDK:** Used for interacting with AWS services.
- **dotenv:** Used for loading environment variables from a `.env` file.
- **download:** A library for downloading files.
- **@google-cloud/storage:** The official Google Cloud Storage library for Node.js.
- **uuid:** A library for generating UUIDs.

## Installation

1. Clone the repository.
2. Run `npm install` to install the required dependencies.
3. Configure the environment variables in a `.env` file.

## Deployment

Deploy the Lambda function in your AWS environment using the AWS Management Console, AWS CLI, or any other preferred deployment method.

## Usage

1. Configure an SNS topic to trigger the Lambda function.
2. Send an SNS message with the required information (email and GitHub repository URL) to the configured SNS topic.
3. The Lambda function will process the submission, download the GitHub repository, upload it to GCS, send email notifications, and save details to DynamoDB.

## Troubleshooting

- Check CloudWatch Logs for Lambda function logs to identify any errors or issues.
- Ensure that the required IAM roles and permissions are set for Lambda function execution.
- Verify that the provided environment variables are correct and accessible.

## Contributors

- Author: Anshul Sharma
- Maintainer: Anshul Sharma

Feel free to contribute by submitting issues or pull requests.
