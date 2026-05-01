import { Navbar } from './_components/Navbar';
import { Hero } from './_components/Hero';
import { Features } from './_components/Features';
import { HowItWorks } from './_components/HowItWorks';
import { Testimonials } from './_components/Testimonials';
import { CTA } from './_components/CTA';
import { Footer } from './_components/Footer';

export default function WebsitePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <Footer />
    </>
  );
}
