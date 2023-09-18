import { useState } from "react";

const name = "Cooper Reed";
const quotes = [
  `"You cannot teach a man anything, you can only help him to find it within himself." \n -Galileo`,
  `"A man who procrastinates in his choosing will inevitably have his choice made for him by circumstance." \n -Hunter S. Thompson`,
  `"The future rewards those who press on. I don\'t have time to feel sorry for myself. I don\'t have time to complain. I\'m going to press on." \n -Barack Obama`,
  '"This is precisely the time when artists go to work. There is no time for despair, no place for self-pity, no need for silence, no room for fear... Like failure, chaos contains information that can lead to knowledge - even wisdom." \n -Toni Morrison',
  '"To me, fun is any time I feel like I really display or I really reach my full potential. When the glass ceiling breaks. That\'s f****** fun for me." \n -Miley Cyrus',
  "\"If you can create different experiences that manifest different desires, then it's possible that those will lead to the production of different worlds.” \n -Moxie Marlinspike",
  '"The fact is that no man is a datum which is passively suffered; the rejection of existence is still another way of existing; nobody can know the peace of the tomb while he is alive." -Simone de Beauvoir',
  '"Honestly, I just kind of wing it" -Sun Tzu',
  '"You can hold yourself back from the sufferings of the world, that is something you are free to do and it accords with your nature, but perhaps this very holding back is the one suffering you could avoid." -Franz Kafka',
  "\"I always said I'd never stoop so low as to be fashionable...it's too easy.\" - Dolly Parton",
  '"If I feed the poor they call me a Saint, if I ask why the poor have no food they call me a communist." -Hélder Câmara',
];

export default function Home() {
  const [quote, setQuote] = useState(
    quotes[Math.floor(Math.random() * quotes.length)]
  );
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-evenly",
        marginTop: "20px",
      }}
    >
      <p>
        <b>Hi, I'm Cooper!</b> Here's my{" "}
        <u>
          <b>
            <a href="https://drive.google.com/file/d/197fniv8a0-iVVzl_aiwSBl6NaFnTppnz/view?usp=sharing">
              Resume.
            </a>
          </b>
        </u>
        &nbsp;I’ve been creating software for six years, music five, web3
        three, and NLP two.
        <br />
        <br />
        To me, <b>Co-Operability</b> means long-term synergy between my
        ambitions and morals. For me, that means open-sourcing all my projects
        and turning my hours into free education for others.
        <br />
        <br />
      </p>
      <div className="flex justify-between">
        <b>A quote that speaks to me:</b>
        <span>&nbsp;&nbsp;</span>
        <button
          className="py-1 px-1 rounded flex text-lg border"
          onClick={() =>
            setQuote(quotes[Math.floor(Math.random() * quotes.length)])
          }
        >
          Randomize
        </button>
        <span suppressHydrationWarning>{quote}</span>
      </div>

    </div>
  );
}
