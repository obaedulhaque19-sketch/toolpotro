import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { PaymentBrandLogo, SendMoneyInstruction } from '../components/PaymentBrandLogo';
import type { LicenseRecord, PaymentDisplaySettings } from '../types';

interface VerifyApiResult {
  valid: boolean;
  status: string;
  softwareId?: string;
  softwareName?: string;
  planName?: string;
  expiresAtMs?: number;
  graceUntilMs?: number;
  maxDevices?: number;
  fixUrl?: string;
  buyUrl?: string;
  message?: string;
}

export function LicenseStatusPage() {
  const { t, language } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKey = (searchParams.get('key') || '').trim().toUpperCase();

  const [keyInput, setKeyInput] = useState(initialKey);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<LicenseRecord | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyApiResult | null>(null);

  // Payment display numbers for resubmit instructions
  const [paymentSettings, setPaymentSettings] = useState<PaymentDisplaySettings>({
    bkashNumber: '',
    nagadNumber: '',
    bkashEnabled: true,
    nagadEnabled: true,
    paymentNote: '',
    defaultGraceHours: 2,
  });
  const [copiedNum, setCopiedNum] = useState<string | null>(null);

  // Resubmit form state
  const [resubmitMethod, setResubmitMethod] = useState<'bkash' | 'nagad'>('bkash');
  const [resubmitPhone, setResubmitPhone] = useState('');
  const [resubmitTrx, setResubmitTrx] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitMsg, setResubmitMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = `${t.licensePage.title} — Toolpotro`;
    return () => {
      document.title = 'Toolpotro — Verified Software, Apps & Extensions';
    };
  }, [t.licensePage.title]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'payment'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setPaymentSettings({
            bkashNumber: typeof d?.bkashNumber === 'string' ? d.bkashNumber.trim() : '',
            nagadNumber: typeof d?.nagadNumber === 'string' ? d.nagadNumber.trim() : '',
            bkashEnabled: d?.bkashEnabled !== false,
            nagadEnabled: d?.nagadEnabled !== false,
            paymentNote: typeof d?.paymentNote === 'string' ? d.paymentNote.trim() : '',
            defaultGraceHours: Number(d?.defaultGraceHours ?? 2),
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!paymentSettings.bkashEnabled && paymentSettings.nagadEnabled) {
      setResubmitMethod('nagad');
    } else if (paymentSettings.bkashEnabled && !paymentSettings.nagadEnabled) {
      setResubmitMethod('bkash');
    }
  }, [paymentSettings.bkashEnabled, paymentSettings.nagadEnabled]);

  const lookupLicense = useCallback(
    async (rawKey: string) => {
      const cleanKey = rawKey.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!cleanKey || cleanKey.length < 8) {
        setErrorMsg(t.licensePage.notFound);
        setLicenseDoc(null);
        setVerifyResult(null);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      setResubmitMsg(null);

      try {
        const snap = await getDoc(doc(db, 'licenses', cleanKey));
        if (!snap.exists()) {
          setLicenseDoc(null);
          setVerifyResult(null);
          setErrorMsg(t.licensePage.notFound);
          setLoading(false);
          return;
        }

        const lic = { id: snap.id, ...(snap.data() as Omit<LicenseRecord, 'id'>) };
        setLicenseDoc(lic);
        const preferred = lic.resubmittedPaymentMethod || lic.paymentMethod;
        if (preferred === 'nagad' || preferred === 'bkash') {
          setResubmitMethod(preferred);
        }

        const apiRes = await fetch(`/api/license/verify?key=${encodeURIComponent(cleanKey)}`);
        const apiJson = (await apiRes.json()) as VerifyApiResult;
        setVerifyResult(apiJson);
      } catch {
        setErrorMsg(t.licensePage.notFound);
      } finally {
        setLoading(false);
      }
    },
    [t.licensePage.notFound]
  );

  useEffect(() => {
    if (initialKey) {
      void lookupLicense(initialKey);
    }
  }, [initialKey, lookupLicense]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInput.trim().toUpperCase();
    if (cleanKey) {
      setSearchParams({ key: cleanKey });
      void lookupLicense(cleanKey);
    }
  };

  const handleResubmitTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseDoc || resubmitting) return;
    const cleanPhone = resubmitPhone.trim().slice(0, 30);
    const cleanTrx = resubmitTrx
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 60);

    if (cleanPhone.length < 4 || cleanTrx.length < 4) {
      setResubmitMsg({
        type: 'error',
        text: 'Please enter a valid sender phone number and Transaction ID (TrxID).',
      });
      return;
    }

    setResubmitting(true);
    setResubmitMsg(null);

    try {
      await updateDoc(doc(db, 'licenses', licenseDoc.licenseKey), {
        resubmittedTrxId: cleanTrx,
        resubmittedPhone: cleanPhone,
        resubmittedPaymentMethod: resubmitMethod,
        resubmittedAtMs: Date.now(),
        updatedAt: serverTimestamp(),
      });

      const matchResp = await fetch('/api/payments/match-trx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trxId: cleanTrx,
          licenseKey: licenseDoc.licenseKey,
          orderId: licenseDoc.orderId,
          amount: licenseDoc.amount,
          paymentMethod: resubmitMethod,
          senderPhone: cleanPhone,
        }),
      });
      const matchJson = (await matchResp.json()) as {
        matched?: boolean;
        reason?: string;
        paidAmount?: number;
        expectedAmount?: number;
        receivedProvider?: string;
        expectedProvider?: string;
      };

      await lookupLicense(licenseDoc.licenseKey);

      if (matchJson.matched) {
        setResubmitMsg({ type: 'success', text: t.licensePage.resubmitSuccessMatched });
      } else if (matchJson.reason === 'already_used') {
        setResubmitMsg({
          type: 'error',
          text: 'This Transaction ID (TrxID) has already been used for another order.',
        });
      } else if (matchJson.reason === 'insufficient_amount') {
        setResubmitMsg({
          type: 'error',
          text: `Paid amount (${currencySymbol}${matchJson.paidAmount ?? '?'}) is less than required (${currencySymbol}${matchJson.expectedAmount ?? licenseDoc.amount}).`,
        });
      } else if (matchJson.reason === 'provider_mismatch') {
        setResubmitMsg({
          type: 'error',
          text: `Provider mismatch: received SMS is ${(matchJson.receivedProvider || '').toUpperCase()}, but ${resubmitMethod.toUpperCase()} was selected.`,
        });
      } else if (matchJson.reason === 'phone_mismatch') {
        setResubmitMsg({
          type: 'error',
          text: 'Sender phone number does not match the payment SMS received by the server.',
        });
      } else {
        setResubmitMsg({ type: 'info', text: t.licensePage.resubmitSuccessPending });
      }
      setResubmitTrx('');
      setResubmitPhone('');
    } catch (err) {
      setResubmitMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update TrxID.',
      });
    } finally {
      setResubmitting(false);
    }
  };

  const effectiveStatus = verifyResult?.status || licenseDoc?.status || '';
  const currencySymbol = licenseDoc?.currency === 'BDT' ? '৳' : '$';
  const canResubmit = effectiveStatus === 'payment_required';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#184549] hover:text-[#062326] dark:text-teal-200/80 dark:hover:text-[#2ee6b8] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.details.backToCatalog}
      </Link>

      {/* Lookup Card */}
      <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/95 dark:bg-[#081a1f]/95 backdrop-blur-xs p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#062326] dark:text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-[#0d9488] dark:text-[#2ee6b8]" />
            <span>{t.licensePage.title}</span>
          </h1>
          <p className="text-sm text-[#1e4347] dark:text-slate-300">
            {t.licensePage.subtitle}
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#4e777b] dark:text-teal-200/50 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              placeholder={t.licensePage.keyPlaceholder}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-white dark:bg-[#051114] font-mono text-sm text-[#062326] dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !keyInput.trim()}
            className="h-11 px-6 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? t.licensePage.checking : t.licensePage.checkBtn}</span>
          </button>
        </form>

        {errorMsg && (
          <div className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3.5 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </section>

      {/* License Details Result */}
      {licenseDoc && (
        <section className="rounded-2xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f2faf8]/95 dark:bg-[#081a1f]/95 backdrop-blur-xs p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Status Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-teal-900/10 dark:border-teal-500/15">
            <div className="space-y-1">
              <p className="font-mono text-xs text-[#2c595d] dark:text-teal-200/70">
                {licenseDoc.softwareName} · {licenseDoc.planName || 'Standard'}
              </p>
              <h2 className="font-mono text-xl font-bold text-[#062326] dark:text-white tracking-wider">
                {licenseDoc.licenseKey}
              </h2>
            </div>

            <div>
              {effectiveStatus === 'verified' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  {t.licensePage.statusVerified}
                </span>
              )}
              {effectiveStatus === 'provisional' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-800 dark:text-[#2ee6b8] text-xs font-bold">
                  <Clock className="w-4 h-4" />
                  {t.licensePage.statusProvisional}
                </span>
              )}
              {effectiveStatus === 'payment_required' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Lock className="w-4 h-4" />
                  {t.licensePage.statusLocked}
                </span>
              )}
              {effectiveStatus === 'expired' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  {t.licensePage.statusExpired}
                </span>
              )}
              {effectiveStatus === 'revoked' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  {t.licensePage.statusRevoked}
                </span>
              )}
            </div>
          </div>

          {/* License Metadata Grid */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-xs text-[#2c595d] dark:text-teal-200/70">Plan / Amount</dt>
              <dd className="font-mono font-semibold text-[#062326] dark:text-white mt-0.5">
                {currencySymbol}{licenseDoc.amount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#2c595d] dark:text-teal-200/70">Submitted TrxID</dt>
              <dd className="font-mono font-semibold text-[#062326] dark:text-white mt-0.5">
                {licenseDoc.resubmittedTrxId || licenseDoc.trxId}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#2c595d] dark:text-teal-200/70">Expires</dt>
              <dd className="font-mono text-[#062326] dark:text-white mt-0.5">
                {licenseDoc.expiresAtMs > 0
                  ? new Date(licenseDoc.expiresAtMs).toLocaleDateString()
                  : t.details.lifetimeLabel}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#2c595d] dark:text-teal-200/70">Devices</dt>
              <dd className="font-mono text-[#062326] dark:text-white mt-0.5">
                {licenseDoc.boundDevices?.length || 0} / {licenseDoc.maxDevices || 1}
              </dd>
            </div>
          </dl>

          {verifyResult?.message && effectiveStatus !== 'verified' && (
            <p className="text-xs text-[#1e4347] dark:text-slate-300 bg-white/70 dark:bg-[#051114] border border-teal-900/10 dark:border-teal-500/15 rounded-xl p-3">
              {verifyResult.message}
            </p>
          )}

          {resubmitMsg && resubmitMsg.type === 'success' && !canResubmit && (
            <div className="rounded-xl p-3.5 text-xs font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
              {resubmitMsg.text}
            </div>
          )}

          {/* Resubmit / Unlock TrxID Section (shown only when status is payment_required) */}
          {canResubmit && (
            <div className="rounded-xl border border-teal-900/15 dark:border-teal-500/20 bg-white/80 dark:bg-[#051114] p-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#062326] dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0d9488] dark:text-[#2ee6b8]" />
                  {t.licensePage.resubmitTitle}
                </h3>
                <p className="text-xs text-[#2c595d] dark:text-teal-200/75 mt-1">
                  {t.licensePage.resubmitSubtitle}
                </p>
              </div>

              <form onSubmit={handleResubmitTrx} className="space-y-3.5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#062326] dark:text-teal-100 block">
                    {t.details.paymentMethodLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {paymentSettings.bkashEnabled && (
                      <button
                        type="button"
                        onClick={() => setResubmitMethod('bkash')}
                        aria-label="bKash (Personal)"
                        aria-pressed={resubmitMethod === 'bkash'}
                        className={`relative h-12 rounded-xl border-2 px-3 flex items-center justify-center transition-all cursor-pointer ${
                          resubmitMethod === 'bkash'
                            ? 'border-[#E2136E] bg-pink-50/90 dark:bg-white shadow-xs ring-2 ring-pink-500/25'
                            : 'border-teal-900/15 dark:border-white/20 bg-white dark:bg-white/95 hover:border-pink-300'
                        }`}
                      >
                        <PaymentBrandLogo method="bkash" variant="selector" />
                        {resubmitMethod === 'bkash' && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E2136E] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    )}
                    {paymentSettings.nagadEnabled && (
                      <button
                        type="button"
                        onClick={() => setResubmitMethod('nagad')}
                        aria-label="Nagad (Personal)"
                        aria-pressed={resubmitMethod === 'nagad'}
                        className={`relative h-12 rounded-xl border-2 px-3 flex items-center justify-center transition-all cursor-pointer ${
                          resubmitMethod === 'nagad'
                            ? 'border-[#F25C19] bg-orange-50/90 dark:bg-white shadow-xs ring-2 ring-orange-500/25'
                            : 'border-teal-900/15 dark:border-white/20 bg-white dark:bg-white/95 hover:border-orange-300'
                        }`}
                      >
                        <PaymentBrandLogo method="nagad" variant="selector" />
                        {resubmitMethod === 'nagad' && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#F25C19] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Single Selected Wallet Receiver Card */}
                  {(() => {
                    const activeNumber =
                      resubmitMethod === 'bkash'
                        ? paymentSettings.bkashNumber
                        : paymentSettings.nagadNumber;
                    return (
                      <div className="rounded-xl border border-teal-900/15 dark:border-teal-500/20 bg-[#f7fcfa] dark:bg-[#081a1f] p-3 space-y-2">
                        <p className="text-[11px] text-[#2c595d] dark:text-teal-200/75 leading-relaxed">
                          <SendMoneyInstruction
                            language={language}
                            method={resubmitMethod}
                            formattedAmount={`${currencySymbol}${licenseDoc.amount}`}
                          />
                        </p>
                        {activeNumber ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-base font-bold text-[#062326] dark:text-white select-all">
                              {activeNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(activeNumber);
                                setCopiedNum(resubmitMethod);
                                setTimeout(() => setCopiedNum(null), 2000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#dff0ec] dark:bg-[#0e2a31] text-[#062326] dark:text-[#2ee6b8] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedNum === resubmitMethod ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedNum === resubmitMethod
                                  ? t.details.copied
                                  : t.details.copyNumber}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Payment number not set yet.
                          </p>
                        )}
                        {paymentSettings.paymentNote && (
                          <p className="text-[11px] text-[#1e4347] dark:text-slate-400 border-t border-teal-900/10 dark:border-teal-500/15 pt-1.5">
                            {paymentSettings.paymentNote}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="tel"
                    required
                    value={resubmitPhone}
                    onChange={(e) => setResubmitPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-[#f7fcfa] dark:bg-[#081a1f] font-mono text-xs text-[#062326] dark:text-white"
                  />
                  <input
                    type="text"
                    required
                    value={resubmitTrx}
                    onChange={(e) => setResubmitTrx(e.target.value.toUpperCase())}
                    placeholder="Valid TrxID (e.g. BKA9X72LMQ)"
                    className="h-10 px-3 rounded-xl border border-teal-900/20 dark:border-teal-500/25 bg-[#f7fcfa] dark:bg-[#081a1f] font-mono text-xs uppercase text-[#062326] dark:text-white"
                  />
                </div>

                <div className="pt-0.5 flex flex-col items-center gap-2.5">
                  <div className="inline-flex items-center justify-center dark:bg-white/95 dark:px-3 dark:py-1 dark:rounded-lg">
                    <PaymentBrandLogo method={resubmitMethod} variant="indicator" />
                  </div>
                  <button
                    type="submit"
                    disabled={resubmitting}
                    className="w-full h-10 px-4 rounded-xl bg-[#0d9488] hover:bg-[#0f766e] text-white dark:bg-[#10d9a0] dark:hover:bg-[#0ec28f] dark:text-slate-950 font-bold text-xs transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {resubmitting ? '...' : t.licensePage.resubmitBtn}
                  </button>
                </div>
              </form>

              {resubmitMsg && (
                <div
                  className={`rounded-lg p-3 text-xs font-medium ${
                    resubmitMsg.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                      : resubmitMsg.type === 'error'
                      ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                      : 'bg-teal-500/15 text-teal-800 dark:text-[#2ee6b8]'
                  }`}
                >
                  {resubmitMsg.text}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link
              to={`/software/${licenseDoc.softwareId}?buy=license`}
              className="text-xs font-semibold text-[#0d9488] dark:text-[#2ee6b8] hover:underline"
            >
              {t.licensePage.buyNewPlan} →
            </Link>
            <button
              type="button"
              onClick={() => void lookupLicense(licenseDoc.licenseKey)}
              className="text-xs font-mono text-[#2c595d] dark:text-teal-200/70 hover:text-[#062326] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
