"use strict";

const fs = require("fs");
const path = require("path");
const url = require("url");
const files = require("./dist/files/files");

const _VERSION = "0.1.5";

/**
 * Requires a modified "main.js" to bind the handler. Install at your own risk.
 */
class Plutonium {
	static init () {
		// Replace the original JSON body parser with our version
		const {json: jsonBodyParser} = require("express");
		const router = global.express.app._router;
		const ixJsonParser = router.stack.findIndex(it => it.name === "jsonParser");
		global.express.app.use(jsonBodyParser({limit: "5mb"}));
		router.stack[ixJsonParser] = router.stack.pop();
		const prefixPart = global.config.options.routePrefix ? `/${global.config.options.routePrefix}/` : "/";
		router.post(`${prefixPart}api/plutonium`, this._post.bind(this));
	}

	static async _post (req, res) { // Flagrant abuse of HTTP verbs
		const {logger} = global;

		const json = req.body;

		logger.info(`Received Plutonium request of type "${json.type}"`);
		switch (json.type) {
			case "getVersion": return this._pHandleGetVersion(req, res);
			case "artBrowserCopyToLocal": return this._pHandleArtBrowserCopyToLocal(req, res);
			case "artBrowserDownloadPack": return this._pHandleArtBrowserDownloadPack(req, res);
			case "artBrowserCancelDownloadPack": return this._pHandleArtBrowserCancelDownloadPack(req, res);
			default: return this._sendError(res, 400, `Unknown Plutonium POST type "${json.type}".`);
		}
	}

	static _getSafeDirectoryPath (dirPath) {
		if (!dirPath) return {
			serverDirPath: this._getForwardSlashed(path.join(global.paths.data)),
			clientDirPath: "",
		};
		let cleanPath = path
			.normalize(this._getCleanDirPath(dirPath))
			.replace(/^(\.\.(\/|\\|$))+/, "");
		return {
			serverDirPath: this._getForwardSlashed(path.join(global.paths.data, cleanPath)),
			clientDirPath: this._getForwardSlashed(cleanPath),
		}
	}

	static _getForwardSlashed (str) {
		if (path.sep === "\\") str = str.replace(/\\/g, "/"); // Convert backslashes on Windows
		return str;
	}

	static _getCleanDirPath (name) {
		return name.replace(/[^a-zA-Z0-9!£$%&()\-_+=\[\]{};'@#~,.\/\\ ]/g, "").replace(/\s+/g, " ");
	}

	static _getCleanFilename (name) {
		return this._getCleanDirPath(name).replace(/[\/\\]/g, "");
	}

	static _getCleanUri (uri) {
		// A shitty hack, but it will serve
		if (!uri.includes("://")) uri = `https://${uri}`;
		return uri;
	}

	static async _pGetUser (req) {
		const {db} = global;
		return db.User.findOne({_id: req.user});
	}

	static _sendError (res, status, message) {
		return res.status(status).send({error: message});
	}

	static _pHandleGetVersion (req, res) { res.send({version: _VERSION}); }

	static async _pHandleArtBrowserCopyToLocal (req, res) {
		const {logger} = global;

		const user = await this._pGetUser(req);
		if (!user.hasPermission("FILES_UPLOAD")) return this._sendError(res, 400, `User ${user._id} does not have permission to upload files.`);

		try {
			const {serverDirPath, clientDirPath} = this._getSafeDirectoryPath(req.body.directoryPath);
			fs.mkdirSync(serverDirPath, {recursive: true});
			const parsed = url.parse(req.body.url);
			const filename = this._getCleanFilename(decodeURIComponent(path.basename(parsed.pathname)));
			const outputPath = this._getForwardSlashed(path.join(serverDirPath, filename));

			await files.downloadRemoteFile(
				this._getCleanUri(req.body.url),
				outputPath,
				{
					onProgress: (chunk, pct) => {
						logger.info(`Downloading "${req.body.url}" (${pct}%)`);
					}
				}
			);
			logger.info(`Saved to ${outputPath}`);

			res.send({path: this._getForwardSlashed(path.join(clientDirPath, filename))});
		} catch (e) {
			logger.error(e);
			this._sendError(res, 500, `Download of "${req.body.url}" failed!`);
		}
	}

	static async _pHandleArtBrowserDownloadPack (req, res) {
		const {logger} = global;
		const {express} = global.config;

		const user = await this._pGetUser(req);
		if (!user.hasPermission("FILES_UPLOAD")) return this._sendError(res, 400, `User ${user._id} does not have permission to upload files.`);

		if (Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id]) return this._sendError(res, 400, `User ${user._id} already has a download in progress.`);
		const ptrIsCancelled = {_: false};
		Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id] = ptrIsCancelled;

		try {
			const pack = req.body.json;
			const {serverDirPath} = this._getSafeDirectoryPath(req.body.directoryPath);
			const dirName = this._getCleanFilename(`${pack.artist}; ${pack.set}`);
			const dirPath = this._getForwardSlashed(path.join(serverDirPath, dirName));
			fs.mkdirSync(dirPath, {recursive: true});

			const len = pack.data.length;
			const lenLen = `${len}`.length;
			const taskList = [];
			let numDownloaded = 0;

			for (let i = 0; i < len; ++i) {
				const fileMeta = pack.data[i];

				const parsed = url.parse(fileMeta.uri);
				const filename = this._getCleanFilename(decodeURIComponent(path.basename(parsed.pathname)));
				const outputPath = this._getForwardSlashed(path.join(dirPath, filename));

				taskList.push(async () => {
					if (ptrIsCancelled._) return;

					try {
						await files.downloadRemoteFile(
							this._getCleanUri(fileMeta.uri),
							outputPath,
							{
								onProgress: (chunk, pct) => {
									// Avoid logging this, to reduce spam
									// logger.info(`Downloading "${fileMeta.uri}" (${`${pct}`.padStart(3, " ")}%)...`);
								}
							}
						);
						numDownloaded++;
						logger.info(`Saved image ${`${numDownloaded}`.padStart(lenLen, " ")}/${len} to ${outputPath}.`);
					} catch (e) {
						numDownloaded++;
						logger.error(`Failed to save image ${`${numDownloaded}`.padStart(lenLen, " ")}/${len} from ${fileMeta.uri} to ${outputPath}. Error was: ${e.message}`);
						logger.error(e)
					}

					if (ptrIsCancelled._) return;

					try {
						express.io.emit(
							"progress",
							{
								type: "plutoniumDownloadPackImage",
								pct: Math.round((numDownloaded / len) * 100),
								text: dirName
							}
						);
					} catch (e) {
						logger.error(e);
					}
				});
			}

			await Promise.all([...new Array(5)].map(async () => {
				while (taskList.length && !ptrIsCancelled._) {
					const task = taskList.pop();
					await task();
				}
			}));

			// Emit a final message in case we cancelled early
			express.io.emit(
				"progress",
				{
					type: "plutoniumDownloadPackImage",
					pct: 100,
					text: dirName
				}
			);

			logger.info(`Saved ${len} image${len === 1 ? "" : "s"}.`);

			res.send({});
		} catch (e) {
			logger.error(e);
			this._sendError(res, 500, `Download of "${req.body.json.set}" failed!`);
		} finally {
			delete Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id];
		}
	}

	static async _pHandleArtBrowserCancelDownloadPack (req, res) {
		const {logger} = global;

		logger.info(`Cancelling active download`);

		const user = await this._pGetUser(req);

		if (!Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id]) return res.send({});

		Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id]._ = true;
		delete Plutonium._ACTIVE_ART_PACK_DOWNLOADS[user._id];

		res.send({});
	}
}
Plutonium._ACTIVE_ART_PACK_DOWNLOADS = {};

module.exports = Plutonium;
