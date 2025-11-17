import { useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import Sessions from './components/Sessions';
import Videos from './components/Videos';
import Instagram from './components/Instagram';
import Team from './components/Team';
import Beats from './components/Beats';
import Discord from './components/Discord';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

function App() {
  useEffect(() => {
    const sectionTitleObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animate-sweep')) {
          entry.target.classList.add('animate-sweep');
        }
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -100px 0px' });

    document.querySelectorAll('.section-title').forEach(title => {
      sectionTitleObserver.observe(title);
    });

    return () => {
      document.querySelectorAll('.section-title').forEach(title => {
        sectionTitleObserver.unobserve(title);
      });
    };
  }, []);

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Sessions />
        <Videos />
        <Instagram />
        <Team />
        <Beats />
        <Discord />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}

export default App;
