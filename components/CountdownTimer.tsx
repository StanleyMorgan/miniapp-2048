import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft: { days?: number, hours?: number } = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000 * 60); // Update every minute is enough

    return () => clearTimeout(timer);
  });

  const timerComponents: string[] = [];

  if (timeLeft.days !== undefined) {
    timerComponents.push(`${timeLeft.days}d`);
  }
  if (timeLeft.hours !== undefined) {
    timerComponents.push(`${timeLeft.hours}h`);
  }

  return (
    <span>
      {timerComponents.length ? timerComponents.join(' ') : 'Ended'}
    </span>
  );
};

export default CountdownTimer;
