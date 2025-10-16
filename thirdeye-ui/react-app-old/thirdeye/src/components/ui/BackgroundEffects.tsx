import React from 'react';
import './BackgroundEffects.css';

const BackgroundEffects = () => {
  return (
    <>
      {/* Animated background elements */}
      <div className="background-effects">
        <div className="background-effects__orb background-effects__orb--purple" />
        <div className="background-effects__orb background-effects__orb--cyan" />
        <div className="background-effects__orb background-effects__orb--pink" />
      </div>

      {/* Floating particles */}
      <div className="floating-particles">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="floating-particles__particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
    </>
  );
};

export default BackgroundEffects;
