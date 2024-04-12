import axios from "axios";
import { load } from "cheerio";
import { AES, enc } from "crypto-js"
import { Anime, Chronology } from "../../../../types/anime";
import { Episode, EpisodeServer } from "../../../../types/episode";
import { AnimeSearch, ResultSearch, IAnimeSearch } from "../../../../types/search";

export class Zoro {
	readonly url = "https://hianime.to";

	async GetAnimeInfo(animeName: string): Promise<Anime> {
		try {
			const response = await axios.get(`${this.url}/watch/${animeName}`);
			const $ = load(response.data);
			const anime = new Anime();
			const aniscInfo = [];

			// get additional anime info
			$("div.anisc-info div.item-title").each((_i, e) => {
				const dataSpan = $(e).children("span.name").text().trim();
				const dataA = $(e).children("a.name").text().trim();
				aniscInfo.push(dataSpan, dataA);
			});

			// remove empty items from the array
			const additionalInfo = aniscInfo.filter((el) => el !== "");

			// set anime properties
			anime.name = $("h2.film-name").text().trim();
			anime.alt_name = [additionalInfo[0]];
			anime.url = `/anime/zoro/name/${animeName.replace("/", "")}`;
			anime.synopsis = $("div.film-description div.text").text().trim();
			anime.image = { url: $("img.film-poster-img").attr("src") };
			anime.genres = [];
			anime.chronology = [];

			// get anime genres
			$("div.anisc-info div.item-list a").each((_i, e) => {
				const genre = $(e).text().trim();
				anime.genres.push(genre);
			});

			// get anime chronology
			$("div.anif-block-ul ul li").each((_i, e) => {
				const chronology = new Chronology();
				chronology.name = $(e).find("h3.film-name").children("a").text().trim();
				chronology.url = `/anime/zoro/name/${$(e)
					.find("h3.film-name")
					.children("a")
					.attr("href")
					.replace("/", "")}`;
				anime.chronology.push(chronology);
			});

			// getEpisodes
			const animeID = animeName.split("-")
			const { data } = await axios.get(`${this.url}/ajax/v2/episode/list/${animeID[animeID.length - 1]}`)
			const document = load(data.html)
			document("a.ssl-item.ep-item").each(
				(_i_, e) => {
					const episode = new Episode();
					episode.name = $(e).attr("title");
					episode.url = $(e).attr("href").replace("/watch/", "/anime/zoro/episode/");
					episode.number = `Episodio ${_i_ + 1}`;
					anime.episodes.push(episode);
				}
			);

			return anime;
		} catch (error) {
			console.log("An error occurred while getting the anime info", error);
			throw new Error("An error occurred while getting the anime info");
		}
	}
	//filter
	async Filter(
		type?: string,
		rated?: string,
		score?: string,
		season?: string,
		language?: string,
		sort?: string,
		genres?: string,
		page_anime?: string,
	) {
		try {

			const { data } = await axios.get(`${this.url}/filter`, {
				params: {
					type: type,
					rated: rated,
					score: score,
					season: season,
					language: language,
					sort: sort || "default",
					genres: genres,
					page: page_anime || 1,
				},
			});

			const $ = load(data);
			const most_cards = $("div.film_list div.film_list-wrap div.flw-item");
			//const page_index = $("div.pre-pagination nav ul li.active");
			const filter_return = new ResultSearch<IAnimeSearch>();
			filter_return.results = [];
			most_cards.each((_i, e) => {
				const anime = new AnimeSearch();
				anime.name = $(e).find("a.dynamic-name").text().trim();
				anime.image = $(e)
					.find("div.film-poster")
					.find("img.film-poster-img")
					.attr("data-src");
				anime.url = `/anime/zoro/name/${$(e)
					.find("a.dynamic-name")
					.attr("href")
					.replace("/", "")}`;
				anime.type = $(e).find("div.fd-infor").children().first().text().trim();
				filter_return.results.push(anime);
			});
			return filter_return;
		} catch (error) {
			console.log("An error occurred while getting the episode servers", error);
			throw new Error("An error occurred while getting the episode servers");
		}
	}

	//episode server
	async GetEpisodeServer(episode: string, episodeId: string) {
		try {
			const animename = episode.toLowerCase().replace(/\s/g, "-")
			const { data } = await axios.get(
				`${this.url}/ajax/v2/episode/servers?episodeId=${episodeId}`,
				{
					headers: {
						"Accept-Encoding": "*r",
						Referer: `https://hianime.to/watch/${animename + "-" + episodeId}`,
						"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
					},
				}
			);
			const $ = load(data.html);
			const epi = new Episode();
			epi.name = data.html.match(/watching <b>(.+?)</)?.[1];
			epi.url = `/anime/zoro/episode/${animename}?ep=${episodeId}`;
			epi.servers = [];

			const promises = $("div.ps__-list div.item").map(
				(_i, e) => {
					const servers = new EpisodeServer();
					const serverId = $(e).attr("data-id").trim();
					const audio = $(e).attr("data-type").trim()
					return this.getServers(serverId).then(
						async (response) => {
							const title = $(e).find("a").text().trim();
							const videoData = response.link;
							servers.name = title;
							servers.url = videoData;
							servers.audio = audio.replace("sub", "Subtitulado").replace("dub", "English");
							switch (title) {
								case "Streamtape":
									servers.file_url = videoData.replace("/e/", "/v/");
									break;
								case "StreamSB":
									servers.file_url = videoData.replace("/e/", "/d/");
									break;
								case "HD-1":
								case "HD-2":
									const embedId = videoData.match(/e-1.(.+)\?k=1/)?.[1]
									const isFound = await this.rabbitStream(embedId)

									if (isFound) {
										servers.file_url = videoData
										servers.url = isFound.m3u8
										servers.tracks = isFound.tracks
									}
									break;
								default:
									break;
							}
							epi.servers.push(servers);
						}).catch(
							(error) => {
								console.log("Error getting servers for episode", error);
								throw new Error("Error getting servers for episode");
							});
				}).get();
			await Promise.all(promises);
			return epi;
		} catch (error) {
			console.log("An error occurred while getting the episode servers", error);
			throw new Error("An error occurred while getting the episode servers");
		}
	}

	private async getServers(id): Promise<any> {
		const { data } = await axios.get(
			`${this.url}/ajax/v2/episode/sources?id=${id}`
		);
		return data;
	}

	private async rabbitStream(embed_id): Promise<any> {
		const { data } = await axios.get(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${embed_id}`, {
			headers: {
				"X-Requested-With": "XMLHttpRequest",
				"Referer": `https://megacloud.tv/embed-2/e-1/${embed_id}?k=1`,
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
			}
		});

		let m3u8 = data.sources[0]
		if (data.encrypted) {
			const key = await this.getKey(data.sources);
			const decrypted = AES.decrypt(key[1], key[0]).toString(enc.Utf8)
			m3u8 = decrypted.match(/https:\/\/.+m3u8/)[0]
		}

		return {
			m3u8,
			tracks: data.tracks,
		}
	}

	private async getKey(cipher): Promise<any> {
		const { data } = await axios.get("https://megacloud.tv/js/player/a/prod/e1-player.min.js?v=1699711377")
		const filt = data.match(/case 0x\d{1,2}:\w{1,2}=\w{1,2},\w{1,2}=\w{1,2}/g).map(element => {
			return element.match(/=(\w{1,2})/g).map(element => {
				return element.substring(1)
			})
		})
		const filt_area = data.match(/\w{1,2}=0x\w{1,2},\w{1,2}=0x\w{1,2},\w{1,2}=0x\w{1,2},\w{1,2}=0x\w{1,2},.+?;/)[0]
		const objectFromVars = filt_area.split(",").reduce((acc, pair) => {
			const [key, value] = pair.split("=");
			acc[key] = parseInt(value);
			return acc;
		}, {});
		const P = filt.length
		let C = cipher
		let I = ''
			, C9 = C
			, CC = 0x0;

		for (let CW = 0x0; CW < P; CW++) {
			let CR, CJ;
			switch (CW) {
				case 0x0:
					CR = objectFromVars[filt[0][0]],
						CJ = objectFromVars[filt[0][1]];
					break;
				case 0x1:
					CR = objectFromVars[filt[1][0]],
						CJ = objectFromVars[filt[1][1]];
					break;
				case 0x2:
					CR = objectFromVars[filt[2][0]],
						CJ = objectFromVars[filt[2][1]];
					break;
				case 0x3:
					CR = objectFromVars[filt[3][0]],
						CJ = objectFromVars[filt[3][1]];
					break;
				case 0x4:
					CR = objectFromVars[filt[4][0]],
						CJ = objectFromVars[filt[4][1]];
					break;
				case 0x5:
					CR = objectFromVars[filt[5][0]],
						CJ = objectFromVars[filt[5][1]];
					break;
				case 0x6:
					CR = objectFromVars[filt[6][0]],
						CJ = objectFromVars[filt[6][1]];
					break;
				case 0x7:
					CR = objectFromVars[filt[7][0]],
						CJ = objectFromVars[filt[7][1]];
					break;
				case 0x8:
					CR = objectFromVars[filt[8][0]],
						CJ = objectFromVars[filt[8][1]];
			}
			var CI = CR + CC
				, CN = CI + CJ;
			I += C.slice(CI, CN),
				C9 = C9.replace(C.substring(CI, CN), ''),
				CC += CJ;
		}
		return [I, C9]
	}
}
