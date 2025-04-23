import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const videoSources = [
  '/videos/vid1.mov',
  '/videos/vid2.mov',
  '/videos/vid3.mov',
  '/videos/vid4.mov', 
];
const Home = () => {
  const [currentVideo, setCurrentVideo] = useState(0

  );
  const [activePlayer, setActivePlayer] = useState(0); // 0 or 1
  const videoRef1 = useRef(null);
  const videoRef2 = useRef(null);
  const handleVideoEnd = () => {
    const nextIndex = (currentVideo + 1) % videoSources.length;
    const nextPlayer = activePlayer === 0 ? 1 : 0;
  
    const incomingRef = nextPlayer === 0 ? videoRef1 : videoRef2;
    const outgoingRef = nextPlayer === 1 ? videoRef1 : videoRef2;
  
    if (incomingRef.current) {
      incomingRef.current.src = videoSources[nextIndex];
  
      // Wait for metadata to load before playing
      incomingRef.current.onloadedmetadata = () => {
        incomingRef.current.play().catch((err) => {
          console.warn('play() failed:', err);
        });
        incomingRef.current.style.opacity = 1;
      };
  
      incomingRef.current.load();
    }
  
    if (outgoingRef.current) {
      outgoingRef.current.style.opacity = 0;
    }
  
    setCurrentVideo(nextIndex);
    setActivePlayer(nextPlayer);
  };
  

  useEffect(() => {
    const video = videoRef1.current;
    document.body.style.overflow = 'hidden';
    if (video) {
      video.src = videoSources[0];
      video.play().catch((err) => {
        console.warn('play() failed on first video:', err);
      });
    }
    return () => {
      document.body.style.overflow = 'auto'; // reset when leaving page
    };
  }, []);
  
return (
<div className="relative h-screen w-full overflow-hidden">
{/* Video Layer 1 */}
  <video
    ref={videoRef1}
    className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000"
    muted
    playsInline
    onEnded={handleVideoEnd}
    style={{ opacity: 1 }}
  />
  
  {/* Video Layer 2 */}
  <video
    ref={videoRef2}
    className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000"
    muted
    playsInline
    onEnded={handleVideoEnd}
    style={{ opacity: 0 }}
  />

<div className="relative z-10 flex flex-col items-center justify-center min-h-screen bg-black/50 px-4">
  {/* Logo Centered Above Box */}
  <img
    src="/pictures/nsbelogo.png"
    alt="NSBE Logo"
    className="mb-6 w-20 h-auto"
  />

  {/* White Box with Text + Buttons */}
  <div className="bg-white bg-opacity-90 p-8 rounded-xl shadow-lg max-w-xl w-full text-center">
  
  <p className="text-base md:text-lg text-gray-700 mb-1">
    Welcome to
  </p>
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
      PSU NSBE’s <br />
      Big Brother Big Sister Program
    </h1>

    <div className="flex flex-col md:flex-row justify-center gap-4">
      <Link
        to="/mentor"
        className="bg-black text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-gray-800 transition"
      >
        Become a Mentor
      </Link>
      <Link
        to="/mentee"
        className="bg-yellow-400 text-black px-6 py-3 rounded-lg text-lg font-medium hover:bg-yellow-300 transition"
      >
        Join as a Mentee
      </Link>
    </div>
  </div>
  <Link
    to="/matching"
    className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white text-sm underline hover:text-yellow-400 transition"
  >
admin 
  </Link>
</div>
</div>

);
};
export default Home;
