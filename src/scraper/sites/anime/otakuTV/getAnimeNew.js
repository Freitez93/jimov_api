import axios from 'axios';
import * as ch from 'cheerio';


async function getAnimeNew(){

  try {
   
  const { data } = await axios.get('https://www1.otakustv.com/')
  
  const $ = ch.load(data);


  const animes = [];
  const getAnimesNew = $("div.reciente div.carusel_reciente .item ").each((i, element) => {
        
    animes.push({
      name: $(element).find('h2').text().trim(),
      url: $(element).find('a').attr('href').replace('https://www1.otakustv.com/anime/', 'anime/otakuTV/'),
      coverImg: $(element).find('a').find('img').attr('data-src'),
      episodesNumber: $(element).find('p').text().replace('video(s)', '').trim(),
    })  

  })

    console.log(animes)
  
    return animes 




  } catch (error) {
   return error 
  }



}

getAnimeNew()
