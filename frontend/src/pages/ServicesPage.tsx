import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// ============================================
// Type Definitions
// ============================================

interface ServiceCategory {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon: string;
  route: string;
}

// ============================================
// ServicesPage Component
// ============================================

function ServicesPage(): ReactNode {
  const navigate = useNavigate();

  const serviceCategories: ServiceCategory[] = [
    {
      id: 'recording',
      title: 'Recording Sessions',
      description: 'Book studio time - 1 to 10 hours',
      badge: 'From $65/hr',
      icon: 'fa-microphone',
      route: '/book?type=recording'
    },
    {
      id: 'mixing',
      title: 'Mixing Services',
      description: 'Professional mixing & mastering',
      badge: 'From $75',
      icon: 'fa-sliders-h',
      route: '/book?type=mixing'
    },
    {
      id: 'promos',
      title: 'Specials & Promos',
      description: 'Bundle deals - Session + Beat',
      badge: 'Save up to 30%',
      icon: 'fa-tags',
      route: '/book?type=promos'
    }
  ];

  const handleCategoryClick = (route: string): void => {
    navigate(route);
  };

  return (
    <div className="services-selector-page">
      <div className="services-selector-container">
        <div className="services-selector-card">
          <div className="services-selector-header">
            <h1>Book a Service</h1>
            <p>Choose what you need</p>
          </div>

          <div className="services-selector-grid">
            {serviceCategories.map((category) => (
              <button
                key={category.id}
                className="service-category-card"
                onClick={() => handleCategoryClick(category.route)}
                aria-label={`Select ${category.title}`}
              >
                <div className="category-icon">
                  <i className={`fas ${category.icon}`} aria-hidden="true"></i>
                </div>
                <h3 className="category-title">{category.title}</h3>
                <p className="category-description">{category.description}</p>
                <span className="category-badge">{category.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Consultation link outside the card */}
        <div className="consultation-link">
          <span>Need help setting up your music business?</span>
          <button onClick={() => handleCategoryClick('/book?type=consulting')}>
            Book a consultation <i className="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServicesPage;
