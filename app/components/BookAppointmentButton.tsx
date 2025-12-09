"use client";

interface BookAppointmentButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function BookAppointmentButton({
  className = "",
  children = "BOOK AN APPOINTMENT",
}: BookAppointmentButtonProps) {
  const handleClick = () => {
    // Check if mobile (md breakpoint is 768px)
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Dispatch custom event to trigger mobile contact form
      window.dispatchEvent(new CustomEvent("openMobileContact"));
      // Scroll to mobile hero area
      const mobileHero = document.getElementById("mobile-hero");
      if (mobileHero) {
        mobileHero.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // Scroll to desktop contact card
      const contactCard = document.getElementById("contact-card");
      if (contactCard) {
        contactCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
