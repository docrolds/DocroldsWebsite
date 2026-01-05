const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Animate section titles on scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-sweep');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.section-title').forEach(title => {
    observer.observe(title);
});

// Placeholder handlers for booking buttons
function handleBookNow() {
    console.log("Book Now clicked");
    alert("Booking functionality is not yet implemented.");
}

function handleSessionBook(sessionType) {
    console.log(`Book Session clicked for: ${sessionType}`);
    alert(`Booking for ${sessionType} is not yet implemented.`);
}

// Fetch and display team members
async function fetchTeamMembers() {
    const teamContainer = document.getElementById('team-container');
    try {
        // Fixed: removed double /api
        const response = await fetch(`${API_URL}/team`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const teamMembers = await response.json();

        if (teamMembers.length === 0) {
            teamContainer.innerHTML = '<p style="color: #ccc; text-align: center;">Team members coming soon.</p>';
            return;
        }

        teamContainer.innerHTML = teamMembers.map(member => {
            // Parse roles - could be JSON string or array
            let roles = [];
            if (typeof member.role === 'string') {
                try {
                    roles = JSON.parse(member.role);
                } catch {
                    roles = [member.role];
                }
            } else if (Array.isArray(member.role)) {
                roles = member.role;
            }
            const roleDisplay = roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' / ');

            // Parse credits
            let credits = [];
            if (typeof member.credits === 'string') {
                try {
                    credits = JSON.parse(member.credits);
                } catch {
                    credits = [];
                }
            } else if (Array.isArray(member.credits)) {
                credits = member.credits;
            }

            // Parse placements
            let placements = [];
            if (typeof member.placements === 'string') {
                try {
                    placements = JSON.parse(member.placements);
                } catch {
                    placements = [];
                }
            } else if (Array.isArray(member.placements)) {
                placements = member.placements;
            }

            // Get photo URL - prioritize photoData (base64), fallback to photoUrl
            const photoSrc = member.photoData || (member.photoUrl ? `${API_URL.replace('/api', '')}/${member.photoUrl}` : '');

            return `
                <div class="team-member">
                    <div class="team-photo-wrapper">
                        ${photoSrc ? `<img src="${photoSrc}" alt="${member.name}" class="team-photo">` : '<div class="team-photo-placeholder"></div>'}
                    </div>
                    <div class="team-info">
                        <h3 class="team-name">${member.name}</h3>
                        <p class="team-role">${roleDisplay}</p>
                        ${member.bio ? `<p class="team-bio">${member.bio}</p>` : ''}
                        ${credits.length > 0 ? `
                            <div class="team-credits">
                                ${credits.map(c => `<span class="credit-tag">${c}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${placements.length > 0 ? `
                            <div class="team-placements">
                                <strong>Placements:</strong>
                                ${placements.map(p => `<span class="placement-tag">${p}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Failed to fetch team members:", error);
        teamContainer.innerHTML = '<p style="color: #E83628; text-align: center;">Could not load team members. Please try again later.</p>';
    }
}

// Initial fetch
document.addEventListener('DOMContentLoaded', fetchTeamMembers);