const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const got = require("got");
const { getSiteURL } = require("./util/auth");
const config = require("./config");

var baseurl;
var apikey;

if (config.context === "production" || config.context === "staging") {
  baseurl = process.env.PROD_LOOKUP_SERVICE_URL;
  apikey = process.env.PROD_LOOKUP_SERVICE_API_KEY;
} else {
  baseurl = process.env.DEV_LOOKUP_SERVICE_URL;
  apikey = process.env.DEV_LOOKUP_SERVICE_API_KEY;
}

exports.handler = async (event, context) => {
  if (
    event.path === "/developer/get-workshop" ||
    event.path === "/developer/get-workshop/"
  ) {
    console.error("Missing workshop");
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No Workshop" }),
    };
  }
  const ws = event.path.replace("/developer/get-workshop/", "");
  const cookies = cookie.parse(event.headers.cookie);
  const decodedToken = jwt.decode(cookies["nf_jwt"]);
  try {
    const remoteUrl = `${baseurl}/${ws}`;
    const availability = await got.get(remoteUrl, {
      headers: {
        Authorization: `Api-Key ${apikey}`,
        "Content-Type": undefined,
      },
    });
    if (availability.statusCode !== 200 || availability.body.error) {
      throw new Error(
        availability.body.error ||
          "Oops. Something went wrong! Try again please."
      );
    }
    var redirectURL = "";
    if (event.queryStringParameters.src) {
      const { src } = event.queryStringParameters;
      redirectURL = src;
    } else {
      redirectURL = event.headers.referer.replace(/$/, "");
    }
    redirectURL = redirectURL.replace(/\?ws_status=unavailable/, "");
    console.log(event.headers.referer);
    console.log(redirectURL);
    const jsonavailbody = JSON.parse(availability.body);
    if (jsonavailbody.available == 0) {
      return {
        statusCode: 302,
        headers: {
          Location: `${redirectURL}?ws_status=unavailable`,
          "Cache-Control": "no-cache",
        },
        body: "",
      };
    }
    const { body, statusCode } = await got.post(remoteUrl, {
      headers: { Authorization: `Api-Key ${apikey}` },
      json: { refer: getSiteURL(), user: decodedToken.id },
    });
    if (statusCode !== 200 || body.error) {
      throw new Error(
        body.error || "Oops. Something went wrong! Try again please."
      );
    }
    const jsonbody = JSON.parse(body);
    const encodedUrl = Buffer.from(jsonbody.url)
      .toString("base64")
      .replace("+", "-")
      .replace("/", "_")
      .replace(/=+$/, "");
    const redirectedUrl = `${getSiteURL()}/developer/workshop-live?ws=${encodedUrl}`;
    return {
      statusCode: 302,
      headers: {
        Location: redirectedUrl,
        "Cache-Control": "no-cache",
      },
      body: "",
    };
  } catch (err) {
    console.error(err.message);
    return {
      statusCode: err.statusCode || 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
