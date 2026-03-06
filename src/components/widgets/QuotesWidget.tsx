import { useState, useEffect } from 'react';
import { Quote, RefreshCw } from 'lucide-react';
import WidgetWrapper from '../WidgetWrapper';

const QUOTES = [
  { text: 'Der einzige Weg, großartige Arbeit zu leisten, ist zu lieben, was man tut.', author: 'Steve Jobs' },
  { text: 'Die Zukunft gehört denen, die an die Schönheit ihrer Träume glauben.', author: 'Eleanor Roosevelt' },
  { text: 'Es ist nicht der Berg, den wir bezwingen – wir bezwingen uns selbst.', author: 'Edmund Hillary' },
  { text: 'Erfolg ist nicht endgültig, Misserfolg ist nicht fatal: Es ist der Mut weiterzumachen, der zählt.', author: 'Winston Churchill' },
  { text: 'Das Geheimnis des Vorwärtskommens ist anzufangen.', author: 'Mark Twain' },
  { text: 'Sei du selbst die Veränderung, die du dir wünschst für diese Welt.', author: 'Mahatma Gandhi' },
  { text: 'Wer kämpft, kann verlieren. Wer nicht kämpft, hat schon verloren.', author: 'Bertolt Brecht' },
  { text: 'Man muss das Unmögliche versuchen, um das Mögliche zu erreichen.', author: 'Hermann Hesse' },
  { text: 'Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.', author: 'Seneca' },
  { text: 'Die beste Zeit einen Baum zu pflanzen war vor 20 Jahren. Die zweitbeste Zeit ist jetzt.', author: 'Chinesisches Sprichwort' },
  { text: 'Kreativität ist Intelligenz, die Spaß hat.', author: 'Albert Einstein' },
  { text: 'In der Mitte der Schwierigkeit liegt die Möglichkeit.', author: 'Albert Einstein' },
  { text: 'Nichts auf der Welt ist so mächtig wie eine Idee, deren Zeit gekommen ist.', author: 'Victor Hugo' },
  { text: 'Was immer du tun kannst oder wovon du träumst – fang damit an.', author: 'Johann Wolfgang von Goethe' },
  { text: 'Hindernisse können dich nicht aufhalten. Probleme können dich nicht aufhalten. Andere Menschen können dich nicht aufhalten. Nur du selbst kannst dich aufhalten.', author: 'Jeffrey Gitomer' },
  { text: 'Der Weg ist das Ziel.', author: 'Konfuzius' },
  { text: 'Jeder Tag ist ein neuer Anfang.', author: 'T.S. Eliot' },
  { text: 'Handle, als ob es unmöglich wäre zu scheitern.', author: 'Dorothea Brande' },
];

export default function QuotesWidget() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    // Pick a random quote based on the day
    const today = new Date();
    const dayIndex = (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % QUOTES.length;
    setIndex(dayIndex);
  }, []);

  const nextQuote = () => {
    setFade(false);
    setTimeout(() => {
      setIndex(prev => (prev + 1) % QUOTES.length);
      setFade(true);
    }, 200);
  };

  const quote = QUOTES[index];

  return (
    <WidgetWrapper widgetId="quotes" title="Zitat des Tages" icon={<Quote size={16} />}>
      <div className={`quote-widget ${fade ? 'fade-in' : 'fade-out'}`}>
        <div className="quote-mark">"</div>
        <p className="quote-text">{quote.text}</p>
        <span className="quote-author">— {quote.author}</span>
      </div>
      <button className="btn-icon quote-refresh" onClick={nextQuote}>
        <RefreshCw size={14} />
      </button>
    </WidgetWrapper>
  );
}
