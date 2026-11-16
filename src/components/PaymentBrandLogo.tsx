import bkashLogo from '../assets/images/bkash-logo.png';
import nagadLogo from '../assets/images/nagad-logo.png';
import type { Language } from '../types';

// Eagerly preload both wallet logos so modal open & method switching have zero flicker
if (typeof window !== 'undefined') {
  const preBkash = new Image();
  preBkash.src = bkashLogo;
  const preNagad = new Image();
  preNagad.src = nagadLogo;
}

interface PaymentBrandLogoProps {
  method: 'bkash' | 'nagad';
  variant?: 'selector' | 'indicator';
  className?: string;
}

export function PaymentBrandLogo({
  method,
  variant = 'selector',
  className = '',
}: PaymentBrandLogoProps) {
  const isBkash = method === 'bkash';
  const src = isBkash ? bkashLogo : nagadLogo;
  const alt = isBkash ? 'bKash' : 'Nagad';
  const heightClass = variant === 'indicator' ? 'h-6 w-auto' : 'h-7 w-auto';

  return (
    <img
      src={src}
      alt={alt}
      width={isBkash ? 342 : 206}
      height={isBkash ? 108 : 91}
      loading="eager"
      decoding="sync"
      draggable={false}
      className={`object-contain select-none pointer-events-none ${heightClass} ${className}`}
    />
  );
}

interface SendMoneyInstructionProps {
  language: Language;
  method: 'bkash' | 'nagad';
  formattedAmount: string;
}

export function SendMoneyInstruction({
  language,
  method,
  formattedAmount,
}: SendMoneyInstructionProps) {
  const accentClass =
    method === 'bkash'
      ? 'text-pink-700 dark:text-pink-300 font-bold'
      : 'text-orange-700 dark:text-orange-300 font-bold';

  if (language === 'bn') {
    const providerBn = method === 'bkash' ? 'বিকাশ' : 'নগদ';
    return (
      <>
        এই <span className={accentClass}>{providerBn}</span> পার্সোনাল নম্বরে ঠিক{' '}
        <span className="font-mono font-bold text-[#062326] dark:text-[#2ee6b8]">
          {formattedAmount}
        </span>{' '}
        টাকা Send Money করুন:
      </>
    );
  }

  const providerEn = method === 'bkash' ? 'bKash' : 'Nagad';
  if (language === 'hi') {
    return (
      <>
        इस <span className={accentClass}>{providerEn}</span> पर्सनल नंबर पर ठीक{' '}
        <span className="font-mono font-bold text-[#062326] dark:text-[#2ee6b8]">
          {formattedAmount}
        </span>{' '}
        Send Money करें:
      </>
    );
  }

  return (
    <>
      Send Money exact{' '}
      <span className="font-mono font-bold text-[#062326] dark:text-[#2ee6b8]">
        {formattedAmount}
      </span>{' '}
      to this <span className={accentClass}>{providerEn}</span> Personal number:
    </>
  );
}
