import { Router } from "express";
import { Zoro } from "../../../../scraper/sites/anime/zoro/Zoro";
const r = Router();

//Route info
r.get("/anime/zoro", (_req, res) => {
	res.send({
		message: "Welcome to the zoro provider: check out the provider's website @ https://HiAnime.to/",
		routes: ["/filter", "/name/:id", "/episode/:episodeId"],
		status: "success",
		code: 200,
		additional_info: {
			server: "https://jimov-api.vercel.app/",
			discord: "https://discord.gg/tyZ39GCX7R",
		},
	});
});

//anime info
r.get("/anime/zoro/name/:name", async (req, res) => {
	try {
		const { name } = req.params;
		const zoro = new Zoro();
		const animeInfo = await zoro.GetAnimeInfo(name);
		res.send(animeInfo);
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});

//episode servers
r.get("/anime/zoro/episode/:episode", async (req, res) => {
	try {
		const episode = req.params.episode
		const episodeId = req.query.ep as string
		const zoro = new Zoro();
		const animeInfo = await zoro.GetEpisodeServer(episode, episodeId);
		res.send(animeInfo);
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});

//filter
r.get("/anime/zoro/filter", async (req, res) => {
	try {
		const type = req.query.type as string;
		const rated = req.query.rated as string;
		const score = req.query.score as string;
		const season = req.query.season as string;
		const language = req.query.language as string;
		const sort = req.query.sort as string;
		const gen = req.query.gen as string;
		const page = req.query.page as string;

		const zoro = new Zoro();
		const animeInfo = await zoro.Filter(type, rated, score, season, language, sort, gen, page);
		res.send(animeInfo);
	} catch (error) {
		console.log(error);
		res.status(500).send(error);
	}
});

export default r;
