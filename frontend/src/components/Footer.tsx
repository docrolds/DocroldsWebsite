import { useState, useEffect, FormEvent } from 'react';
import { API_URL } from '../config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FooterContent {
  description: string;
  subscribeText: string;
}

interface SocialLink {
  icon: string;
  url: string;
  title: string;
}

interface ContentResponse {
  footer?: FooterContent;
}

function Footer(): JSX.Element {
  const [footerContent, setFooterContent] = useState<FooterContent>({
    description: 'Connect with Doc Rolds on social media',
    subscribeText: 'Get updates on new beats and services.'
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);

    fetch(`${API_URL}/content`)
      .then((res) => res.json())
      .then((data: ContentResponse) => {
        if (data?.footer) {
          setFooterContent(data.footer);
        }
      })
      .catch((err: Error) => console.error('Failed to fetch footer content:', err));
  }, []);

  const handleNewsletterSignup = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
    const email = emailInput?.value ?? '';
    alert(`Thanks for subscribing with ${email}! Check your inbox for exclusive content.`);
    form.reset();
  };

  const handleAdminEdit = (): void => {
    alert('Footer editing coming soon');
  };

  // TODO: Update these URLs with actual Doc Rolds social profiles before launch
  const socialLinks: SocialLink[] = [
    { icon: 'fab fa-instagram', url: 'https://instagram.com/docrolds', title: 'Instagram' },
    { icon: 'fab fa-facebook', url: 'https://facebook.com/docrolds', title: 'Facebook' },
    { icon: 'fab fa-youtube', url: 'https://www.youtube.com/@RealDocrolds', title: 'YouTube' },
    { icon: 'fab fa-tiktok', url: 'https://tiktok.com/@docrolds', title: 'TikTok' },
    { icon: 'fab fa-x', url: 'https://x.com/docrolds', title: 'X' },
    { icon: 'fab fa-discord', url: 'https://discord.gg/docrolds', title: 'Discord' }
  ];

  return (
    <footer className="relative">
      {isAdmin && (
        <Button
          onClick={handleAdminEdit}
          size="icon"
          className="absolute top-4 right-4 rounded-full z-10"
        >
          ✏️
        </Button>
      )}

      <div className="footer-content">
        <div className="footer-section">
          <p className="leading-relaxed text-muted-foreground text-[0.95rem]">
            {footerContent.description}
          </p>
          <div className="social-links">
            {socialLinks.map((link) => (
              <a
                key={link.title}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.title}
                aria-label={`Follow Doc Rolds on ${link.title} (opens in new tab)`}
              >
                <i className={link.icon} aria-hidden="true"></i>
              </a>
            ))}
          </div>

          <div className="mt-10">
            <h3>Subscribe</h3>
            <p className="leading-relaxed text-muted-foreground text-[0.95rem] mb-4">
              Get updates on new beats and services.
            </p>
            <form className="newsletter-form" onSubmit={handleNewsletterSignup}>
              <Input type="email" placeholder="your@email.com" required />
              <Button type="submit">Subscribe</Button>
            </form>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Doc Rolds. All rights reserved. Dreams Over Careers.</p>
        <p className="mt-2 text-sm">
          Crafted with passion for independent artists
        </p>
      </div>
    </footer>
  );
}

export default Footer;
