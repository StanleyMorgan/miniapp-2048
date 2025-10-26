import React, { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  targetDate?: string;
  dailyResetUtc?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, dailyResetUtc }) => {
  const calculateTimeLeft = useCallback(() => {
    if (dailyResetUtc) {
      const now = new Date();
      // Calculate the next midnight UTC.
      const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const difference = tomorrowUtc.getTime() - now.getTime();
      
      let timeLeft: { hours?: number, minutes?: number } = {};

      if (difference > 0) {
        timeLeft = {
          // Total hours until next midnight. Will be < 24.
          hours: Math.floor(difference / (1000 * 60 * 60)),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        };
      }
      return timeLeft;
    }

    if (targetDate) {
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft: { days?: number, hours?: number } = {};

        if (difference > 0) {
          timeLeft = {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          };
        }
        return timeLeft;
    }

    return {};
  }, [dailyResetUtc, targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    // Update every second for higher accuracy when the minute ticks over.
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000); 

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  // Render logic for daily reset timer
  if (dailyResetUtc) {
    // FIX: Use `in` operator as a type guard to safely access properties on the union type.
     if (!('minutes' in timeLeft) || timeLeft.hours === undefined || timeLeft.minutes === undefined) {
         // Show a default before the first calculation or if time is up
         return <span>00h 00m</span>;
     }
     const hours = String(timeLeft.hours).padStart(2, '0');
     const minutes = String(timeLeft.minutes).padStart(2, '0');
     return <span>{`${hours}h ${minutes}m`}</span>
  }
  
  // Original render logic for fixed date timer
  const timerComponents: string[] = [];
  // FIX: Use `in` operator as a type guard to safely access properties on the union type.
  if ('days' in timeLeft && timeLeft.days !== undefined) {
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