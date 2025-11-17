import { useState } from 'react';

function FAQ() {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const faqCategories = [
    {
      category: 'Production & Engineering',
      questions: [
        {
          id: 'pe-1',
          question: 'What is the difference between a Producer and an Engineer?',
          answer: 'The Engineer is the scientific expert in sound capture and manipulation, focused on technical fidelity: precision recording, balanced mixing, and professional mastering. The Producer is the creative executive who sculpts the artistic vision, focused on musical impact: guiding the arrangement, coaching the performance, and shaping the final artistic statement. We offer both roles depending on your project\'s needs.'
        },
        {
          id: 'pe-2',
          question: 'How do I book studio time or a consultation?',
          answer: 'Click the "Book Now" button to schedule your session. Our booking system integrates Square for secure payment processing, allowing you to reserve your time and complete payment in one seamless transaction. You can also reach out through our Discord community for questions before booking.'
        },
        {
          id: 'pe-3',
          question: 'What are your rates for production, engineering, and mixing?',
          answer: 'Rates vary based on the scope of the project, required services (e.g., mixing only vs. full production), and duration. We offer project-based fees and hourly rates. Please contact us with details about your song or album for a detailed, custom quote.'
        },
        {
          id: 'pe-4',
          question: 'Do you offer remote sessions?',
          answer: 'Yes! We work with artists remotely. You can send your vocal stems or demos, and we\'ll handle the production, mixing, and mastering. We communicate via email, Discord, or video calls to ensure your vision is captured perfectly.'
        }
      ]
    },
    {
      category: 'Publishing & Administration',
      questions: [
        {
          id: 'pa-1',
          question: 'What is music publishing and why do I need it?',
          answer: 'Music publishing involves the business of your musical compositions (the lyrics and the underlying beat/instrumental arrangement). We register your copyrights, issue licenses for your songs to be used in films, ads, covers, or as interpolations, and collect all due royalties (performance, mechanical, print, and synchronization). You need it to ensure you are paid every time your song is used commercially.'
        },
        {
          id: 'pa-2',
          question: 'Do I lose my rights if you administer my publishing?',
          answer: 'No. You retain 100% of your copyright. Our administration agreement is a license that allows us to manage your songs for a set period and territory, in exchange for a percentage of the royalties we collect for you.'
        },
        {
          id: 'pa-3',
          question: 'What is a sync license and how do you help me get one?',
          answer: 'A synchronization (sync) license is permission granted by the copyright owner to use a song in visual media (like a TV show, movie, or commercial). We actively pitch your music to our network of music supervisors and negotiate the best possible fee and terms for the usage of your song.'
        },
        {
          id: 'pa-4',
          question: 'How long does it take to collect royalties?',
          answer: 'Royalty collection timelines vary by source. Performance royalties typically take 3-6 months to report and distribute. Mechanical royalties depend on the licensing body. We provide detailed reporting so you can track all incoming revenue.'
        }
      ]
    },
    {
      category: 'Technical & Deliverables',
      questions: [
        {
          id: 'td-1',
          question: 'What should I provide if I\'m sending a song for mixing?',
          answer: 'Please provide us with clean, unedited, dry (no effects) individual track stems (WAV or AIFF files) at the same sample rate and bit depth they were recorded in (e.g., 24-bit, 44.1kHz). Ensure all tracks start at the exact same point (time zero) in your session. Bundle everything in a ZIP file including: all stems, a demo song (reference mix), any production notes or creative direction, your contact information, and your desired deadline. This helps us deliver exactly what you envision.'
        },
        {
          id: 'td-2',
          question: 'What format will I receive my final masters in?',
          answer: 'You will receive a high-resolution master file (usually a 24-bit, 48kHz WAV file for streaming) along with MP3 versions for review. We deliver all masters ready for distribution.'
        },
        {
          id: 'td-3',
          question: 'How long does the mixing and mastering process take?',
          answer: 'This depends on our current queue and the complexity of the song. Generally, allow 3–5 business days for mixing and an additional 1–2 business days for mastering, per song. We will provide a firm deadline upon booking and payment.'
        },
        {
          id: 'td-4',
          question: 'Can I request revisions after delivery?',
          answer: 'Yes! Our mixing and mastering packages include a set number of revision rounds (typically 2-3). Additional revisions may incur extra fees. Please let us know your feedback within 48 hours of delivery for the fastest turnaround.'
        },
        {
          id: 'td-5',
          question: 'What sample rates and bit depths do you work with?',
          answer: 'We work with industry-standard specifications: 24-bit, 44.1kHz or 48kHz for mixing, and we master to 24-bit, 48kHz for streaming platforms. We can also deliver in 16-bit, 44.1kHz for CD manufacturing or other formats upon request.'
        }
      ]
    }
  ];

  const toggleExpand = (id) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <section id="faq" style={{ margin: '4rem 0', position: 'relative' }}>
      <h2 className="section-title">Frequently Asked Questions</h2>
      
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>
        {faqCategories.map((categoryGroup, catIndex) => (
          <div key={catIndex} style={{ marginBottom: '3rem' }}>
            <h3 style={{
              color: '#E83628',
              fontSize: '1.2rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid rgba(232, 54, 40, 0.3)'
            }}>
              {categoryGroup.category}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {categoryGroup.questions.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'rgba(26, 31, 38, 0.6)',
                    border: '1px solid rgba(232, 54, 40, 0.2)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <button
                    onClick={() => toggleExpand(item.id)}
                    style={{
                      width: '100%',
                      padding: '1.5rem',
                      background: expandedItems.has(item.id) 
                        ? 'rgba(232, 54, 40, 0.1)' 
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!expandedItems.has(item.id)) {
                        e.currentTarget.style.background = 'rgba(232, 54, 40, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!expandedItems.has(item.id)) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{
                      color: '#e0e0e0',
                      fontSize: '1rem',
                      fontWeight: '500',
                      textAlign: 'left',
                      flex: 1
                    }}>
                      {item.question}
                    </span>
                    <span style={{
                      color: '#E83628',
                      fontSize: '1.3rem',
                      marginLeft: '1rem',
                      transition: 'transform 0.3s ease',
                      transform: expandedItems.has(item.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0
                    }}>
                      ▼
                    </span>
                  </button>

                  {expandedItems.has(item.id) && (
                    <div style={{
                      padding: '0 1.5rem 1.5rem 1.5rem',
                      borderTop: '1px solid rgba(232, 54, 40, 0.2)',
                      animation: 'slideDown 0.3s ease'
                    }}>
                      <p style={{
                        color: '#aaa',
                        fontSize: '0.95rem',
                        lineHeight: '1.8',
                        margin: '0'
                      }}>
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{
          background: 'rgba(232, 54, 40, 0.1)',
          border: '1px solid rgba(232, 54, 40, 0.3)',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          marginTop: '3rem'
        }}>
          <p style={{
            color: '#ccc',
            fontSize: '0.95rem',
            lineHeight: '1.8',
            marginBottom: '1.5rem'
          }}>
            Can't find the answer you're looking for? Reach out to our team directly!
          </p>
          <a
            href="#"
            style={{
              display: 'inline-block',
              padding: '0.8rem 2rem',
              background: '#E83628',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(232, 54, 40, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Contact Us
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

export default FAQ;
