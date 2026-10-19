import type { FilmReview } from "./importer.ts";

// Deliberately a release allow-list, not an assertion that every source row is correct.
// Counts are checked against the pinned JSON; these references independently check
// the complete film totals/Best Picture outcome. No reference prose is reproduced.
const positive = (tmdbId:number,title:string,releaseYear:number,nominations:number,wins:number,
  pictureNominated:boolean,pictureWon:boolean,evidence:string[]):FilmReview => ({
    tmdbId,title,releaseYear,nominations,wins,pictureNominated,pictureWon,evidence,
    note:"Complete competitive nomination/win totals and Best Picture result checked independently; source entries agree.",
  });
const wiki = (page:string) => `https://en.wikipedia.org/wiki/${page}`;
const zeroReference = "https://editorial.rottentomatoes.com/article/10-movie-classics-the-oscars-ignored/";
export const FILM_REVIEWS: FilmReview[] = [
  positive(27205,"Inception",2010,8,4,true,false,["https://www.cbsnews.com/pictures/inception/",wiki("Inception")]),
  positive(597,"Titanic",1997,14,11,true,true,[wiki("Titanic_(1997_film)")]),
  positive(545611,"Everything Everywhere All at Once",2022,11,7,true,true,[wiki("Everything_Everywhere_All_at_Once"),"https://time.com/6261965/everything-everywhere-all-at-once-oscars-frontrunner/"]),
  positive(872585,"Oppenheimer",2023,13,7,true,true,[wiki("Oppenheimer_(film)")]),
  positive(346698,"Barbie",2023,8,1,true,false,[wiki("Barbie_(film)")]),
  positive(496243,"Parasite",2019,6,4,true,true,[wiki("Parasite_(2019_film)")]),
  positive(278,"The Shawshank Redemption",1994,7,0,true,false,[wiki("The_Shawshank_Redemption")]),
  positive(389,"12 Angry Men",1957,3,0,true,false,[wiki("12_Angry_Men_(1957_film)")]),
  positive(15,"Citizen Kane",1941,9,1,true,false,[wiki("Citizen_Kane")]),
  positive(872,"Singin' in the Rain",1952,2,0,false,false,[wiki("Singin%27_in_the_Rain")]),
  ...([
    [19,"Metropolis",1927,[1927,1928]], [115,"The Big Lebowski",1998,[1998]],
    [203,"Mean Streets",1973,[1973]], [244,"King Kong",1933,[1933]],
    [269,"Breathless",1960,[1960,1961]], [335,"Once Upon a Time in the West",1968,[1968,1969]],
    [694,"The Shining",1980,[1980]], [832,"M",1931,[1931,1932,1933]],
    [949,"Heat",1995,[1995]], [6415,"Three Kings",1999,[1999]],
  ] as [number,string,number,number[]][]).map(([tmdbId,title,releaseYear,eligibleAwardYears]):FilmReview => ({
    tmdbId,title,releaseYear,eligibleAwardYears,nominations:0,wins:0,pictureNominated:false,pictureWon:false,
    evidence:[zeroReference],
    note:"Explicit no-Oscar-nominations reference for this original film; checked source absence through 2023. Historic original/US-release eligibility periods, including the following ceremony, are covered. Remakes are separate IDs. Not inferred from source absence alone.",
  })),
];
