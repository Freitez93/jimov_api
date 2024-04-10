import axios from "axios";
import { load } from "cheerio";
import { Anime, Chronology } from "../../../../types/anime";
import { Episode, EpisodeServer } from "../../../../types/episode";
import {
	Genres,
	OrderAnimeflv,
	StatusAnimeflv,
	TypeAnimeflv,
} from "./animeflv_helper";
import {
	AnimeSearch,
	ResultSearch,
	IResultSearch,
	IAnimeSearch,
} from "../../../../types/search";

export class AnimeFlv {
	readonly url = "https://animeflv.net";

	async GetAnimeInfo(anime: string): Promise<Anime> {
		try {
			const { data } = await axios.get(`${this.url}/anime/${anime}`);
			const $ = load(data);
			const title = $("h1.Title").text().trim();
			const title_alt = $("span.TxtAlt").text().trim();
			const img = `${this.url + $("div.AnimeCover .Image figure img").attr("src")}`;
			const status = $("p.AnmStts span").text().trim();
			const synopsis = $("div.Description").text().trim();
			const episodes = data.match(/var episodes = (\[.+\]);/)?.[1];
			const AnimeReturn = new Anime();
			AnimeReturn.name = title;
			AnimeReturn.alt_name = [...title_alt.split(",")];
			AnimeReturn.image = {
				url: img,
			};
			AnimeReturn.status = status;
			AnimeReturn.synopsis = synopsis;
			AnimeReturn.chronology = [];

			//getRelated
			$("ul.ListAnmRel li a").each((_i, e) => {
				const cro = new Chronology();
				cro.name = $(e).text().trim();
				cro.url = $(e).attr("href");
				AnimeReturn.chronology.push(cro);
			});
			//get genres
			$("nav.Nvgnrs a").each((_i, e) => {
				const gen = $(e).text();
				AnimeReturn.genres.push(gen.trim());
			});
			//get episodes
			JSON.parse(episodes).map(_i_ => {
				const l = `${anime}-${_i_[0]}`;
				const episode = new Episode();
				episode.name = title;
				episode.url = `/anime/flv/episode/${l}`;
				episode.number = `Episodio ${_i_[0]}`;
				episode.image = "";
				AnimeReturn.episodes.push(episode);
			});
			return AnimeReturn;
		} catch (error) {
			console.log(
				"An error occurred while getting the anime info: invalid name",
				error
			);
			throw new Error(
				"An error occurred while getting the anime info: invalid name"
			);
		}
	}

	async Filter(
		gen?: Genres | string,
		date?: string,
		type?: TypeAnimeflv,
		status?: StatusAnimeflv,
		ord?: OrderAnimeflv,
		page?: number,
		title?: string
	): Promise<IResultSearch<IAnimeSearch>> {
		try {
			const { data } = await axios.get(`${this.url}/browse`, {
				params: {
					genre孝: gen,
					year孝: date,
					status孝: status,
					type孝: type,
					order: ord || "default",
					page: page || 1,
					q: title,
				},
			});

			const $ = load(data);
			const infoList = $("ul.ListAnimes li");
			const data_filter = new ResultSearch<IAnimeSearch>();
			data_filter.results = [];
			infoList.each((_i, e) => {
				const info = new AnimeSearch();
				info.name = $(e).find("h3").text().trim();
				info.image = $(e).find("img").attr("src");
				info.url = $(e).find("a").attr("href").replace("/anime/", "/anime/flv/name/");
				info.type = $(e).find("span.Type").first().text().trim();
				data_filter.results.push(info);
			});
			return data_filter;
		} catch (error) {
			console.log("An error occurred while getting the filter values", error);
			throw new Error("An error occurred while getting the filter values");
		}
	}

	async GetEpisodeServers(episode: string): Promise<Episode> {
		try {
			const { data } = await axios.get(`${this.url}/ver/${episode}`);
			const $ = load(data);
			const title = $(".CapiTop").children("h1").text().trim();
			const getLinks = data.match(/var videos = ({.+?);/)?.[1];
			const numberEpisode = episode.substring(episode.lastIndexOf("-") + 1)
			const episodeReturn = new Episode();
			episodeReturn.name = title;
			episodeReturn.url = `/ver/${episode}`;
			episodeReturn.number = numberEpisode as unknown as string;
			episodeReturn.servers = [];

			const promises = JSON.parse(getLinks).SUB.map(async _i => {
				const servers = new EpisodeServer();
				const title = _i.title;
				const videoData = _i.code;
				servers.name = title;
				servers.url = videoData;

				if (videoData.includes("streaming.php")) {
					await this.getM3U(`${videoData.replace("streaming.php", "ajax.php")}&refer=none`).then((g) => {
						if (g.source.length) {
							servers.file_url = g.source[0].file;
						}
					});
				}
				switch (title) {
					case "Mega":
						servers.file_url = videoData
							.replace("embed#!", "file/")
							.replace("!", "#");
						break;
					case "Streamtape":
						servers.file_url = videoData.replace("/e/", "/v/");
						break;
					case "YourUpload":
						servers.file_url = videoData.replace("/embed/", "/watch/");
						break;
					case "Vidlox":
					case "Doodstream":
					case "Streamsb":
					case "Filemoon":
						servers.file_url = videoData.replace("/e/", "/d/");
						break;
					default:
						break;
				}
				episodeReturn.servers.push(servers);
			});
			await Promise.all(promises);
			return episodeReturn;
		} catch (error) {
			console.log("An error occurred while getting the episode servers", error);
			throw new Error("An error occurred while getting the episode servers");
		}
	}

	private async getM3U(vidurl: string) {
		try {
			const res = await axios.get(vidurl);

			return res.data;
		} catch (error) {
			console.log(error)
		}
	}
}
