import { useCustomerAuth } from '../context/CustomerAuthContext';
import { Button } from '@/components/ui/button';

function ImpersonationBanner() {
  const { isImpersonating, customer, logout } = useCustomerAuth();

  if (!isImpersonating) return null;

  const handleEndSession = () => {
    logout();
    window.close();
  };

  return (
    <div className="fixed top-0 left-0 right-0 gradient-primary text-white py-2 px-4 flex justify-center items-center gap-4 z-[10000] text-sm font-medium shadow-lg">
      <span>
        Admin View: You are viewing the site as {customer?.email || 'customer'}
      </span>
      <Button
        onClick={handleEndSession}
        variant="ghost"
        size="sm"
        className="bg-white/20 border border-white/40 text-white hover:bg-white/30 hover:text-white text-[13px] py-1 px-3"
      >
        End Session
      </Button>
    </div>
  );
}

export default ImpersonationBanner;
