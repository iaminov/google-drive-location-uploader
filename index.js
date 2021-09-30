//Author: Isakhar Aminov

const https = require('https');
const http = require('http');
const fs = require('fs');
const url = require("url");


const port = 3000;
const server = http.createServer();
var results;
const { client_id, client_secret } = require('./auth/credentials.json');


server.on("request", connection_handler);
function connection_handler(req, res) {
    console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
    if (req.url === '/' || req.url === '/?') {
        const main = fs.createReadStream('html/main.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        main.pipe(res);
    }
    else if (req.url === '/favicon.ico') {
        const main = fs.createReadStream('images/favicon.ico')
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        main.pipe(res);
    }
    else if (req.url === '/images/banner.jpg') {
        const main = fs.createReadStream('images/banner.jpg')
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        main.pipe(res);
    }
    else if (req.url.startsWith("/search")) {
        let { ip_address } = url.parse(req.url, true).query;
        get_location_information(ip_address, res)
    }
    else if (req.url.startsWith("/login.html")) {
        const redirect_url = new URL(`http://localhost:${port}${req.url}`);
        const code = redirect_url.searchParams.get('code');
        const headers = { "Content-Type": `application/x-www-form-urlencoded` }
        const options = { method: 'POST', headers: headers }
        const token_request = https.request("https://oauth2.googleapis.com/token", options);
        token_request.on("response", (res) => after_get_token(res));
        token_request.once("error", err => { throw err });
        token_request.end(`code=${code}&client_id=${client_id}&client_secret=${client_secret}&redirect_uri=http://localhost:${port}/login.html&grant_type=authorization_code`);
        res.write(results);
        if (res.statusCode == 200) {
            res.write("The results were successfully uploaded to your Google Drive on: " + new Date());
        }
        else {
            res.write("An error occured.");
        }
        res.write(`<br><br/><form action="http://localhost:${port}"><input type="submit" value="Click here to restart and enter another IP address" /></form>`)
        res.end();

    }
    else {
        res.end("404 Not Found");
    }
}

function received_authentification(auth_message, results) {
    let google_auth = JSON.parse(auth_message);
    const headers = { "Content-Type": `text/plain`, "Authorization": `Bearer ${google_auth.access_token}` }
    const options = { method: 'POST', headers: headers }
    const google_drive_upload_endpoint = "https://www.googleapis.com/upload/drive/v3/files?uploadType=media";
    const upload_to_google_drive_request = https.request(google_drive_upload_endpoint, options);
    upload_to_google_drive_request.end(results);

}

function stream_to_message(stream, callback) {
    let body = "";
    stream.on("data", (chunk) => body += chunk);
    stream.on("end", () => callback(body));

}

function after_get_token(incoming_msg_stream) {
    stream_to_message(incoming_msg_stream, message => received_authentification(message, results));
}

function get_location_information(ip, res) {
    const IP_Location_API_endpoint = `http://ip-api.com/json/`;
    const location_request = http.get(`${IP_Location_API_endpoint}/${ip}`, { method: "POST" });
    location_request.once("error", err => { throw err });
    location_request.once("response", process_stream);
    function process_stream(location_stream) {
        let location_data = "";
        location_stream.on("data", chunk => location_data += chunk);
        location_stream.on("end", () => save_result(location_data, res));
    }
}

function save_result(location_data, res) {
    let location_object = JSON.parse(location_data);
    results = `<h1>IP API Location Results:</h1><ul><b>Country:</b> ${location_object.country}</ul> <ul><b>Region:</b> 
        ${location_object.regionName}</ul><ul><b>City:</b> ${location_object.city}</ul><ul><b>Zip:</b> ${location_object.zip}</ul>`
    loginToGoogleDrive(res);
}

function loginToGoogleDrive(res) {
    const google_drive_API_endpoint = 'https://accounts.google.com/o/oauth2/v2/auth?'
    const google_drive_API_options = `scope=https%3A//www.googleapis.com/auth/drive.file&include_granted_scopes=true&response_type=code&access_type=offline&redirect_uri=http://localhost:${port}/login.html`;
    res.writeHead(302, { Location: `${google_drive_API_endpoint}${google_drive_API_options}&client_id=${client_id}` });
    res.end();
}


server.on("listening", listening_handler);
function listening_handler() {
    console.log(`Now Listening on Port ${port}`);
}
server.listen(port);

