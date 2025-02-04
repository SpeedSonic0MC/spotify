import fetch from "node-fetch";
import open from "open";
import express from "express";
import path, { format } from "node:path";
import "dotenv";
import "colors";
const __dirname = import.meta.dirname;

const app = express();
const print = (t) => console.log("[".gray + "RISE".yellow + "]: ".gray + t);

let client_id = null,
	client_secret = null;
let accessToken = null;

app.get("/", (_, res) => {
	res.send("ok");
});

app.get("/set-credentials", (req, res) => {
	if (!req.query.id || !req.query.secret) return res.send("oh hell nah");
	client_id = req.query.id;
	client_secret = req.query.secret;
	print("Set Spotify clientId: " + client_id);
	print("Set Spotify clientSecret: " + client_secret);
	res.send("ok");
});

app.get("/callback", (req, res) => {
	if (!req.query.code || !client_id || !client_secret) {
		res.sendFile(path.join(__dirname, "pages", "spotifyFail.html"));
	} else {
		const params = new URLSearchParams();
		params.append("code", req.query.code);
		params.append("redirect_uri", "http://localhost:8888/callback");
		params.append("grant_type", "authorization_code");
		fetch("https://accounts.spotify.com/api/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization:
					"Basic " +
					new Buffer.from(client_id + ":" + client_secret).toString(
						"base64"
					),
			},
			body: params.toString(),
		})
			.catch(() => {
				res.sendFile(path.join(__dirname, "pages", "spotifyFail.html"));
			})
			.then((x) => x.json())
			.then((x) => {
				if (!x["access_token"])
					return res.sendFile(
						path.join(__dirname, "pages", "spotifyFail.html")
					);
				accessToken = x["access_token"];
				print("Set Spotify Access Token: " + accessToken);
				res.sendFile(
					path.join(__dirname, "pages", "spotifySuccess.html")
				);
			});
	}
});

const openAuthorization = () => {
	open(
		"https://accounts.spotify.com/authorize?response_type=code&client_id=" +
			client_id +
			"&scope=user-read-playback-state&redirect_uri=http://localhost:8888/callback"
	);
};

function formatDuration(milliseconds) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
			2,
			"0"
		)}:${String(seconds).padStart(2, "0")}`;
	} else {
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
			2,
			"0"
		)}`;
	}
}

app.get("/current-song-data", (_, res) => {
	if (!accessToken) {
		openAuthorization();
		res.json({
			error: "missing_access_token",
		});
	} else {
		fetch("https://api.spotify.com/v1/me/player?market=US", {
			headers: {
				Authorization: "Bearer " + accessToken,
			},
		})
			.catch(() => res.json({ error: "failed" }))
			.then((e) => {
				if ([401, 403, 429].includes(e.status)) {
					openAuthorization();
					return res.json({ error: "failed" });
				}
				if (e.status != 200)
					return res.json({
						success: true,
						current: null,
						status: e.status,
					});
				e.json().then((x) => {
					const item = x.item;
					if (!item)
						return res.json({
							success: true,
							current: null,
							status: e.status,
						});
					const progress = x["progress_ms"];
					const full = item["duration_ms"];
					const name = item.name;
					const thumbnail = item.album.images[0].url;
					const artists = item.album.artists
						.map((x) => x.name)
						.join(", ");
					res.json({
						name,
						thumbnail,
						artists,
						percentage: progress / full,
						full: formatDuration(full),
						progress: formatDuration(progress),
					});
				});
			});
	}
});

app.use("*", (_, res) => {
	res.status(404).end();
});

app.listen(8888, () => {
	console.clear();
	print("Spotify Module Handler by SpeedSonic0");
});
