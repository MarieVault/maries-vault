import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { CheckCircle, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ShareHandler() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');
  const [entryId, setEntryId] = useState<number | null>(null);

  useEffect(() => {
    const processShare = async () => {
      try {
        // Get the status and data from URL parameters (set by server redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        const entryId = urlParams.get('entryId');
        const message = urlParams.get('message');
        
        if (status === 'success') {
          setStatus('success');
          setMessage('Content added to vault!');
          setEntryId(entryId ? parseInt(entryId) : null);
        } else if (status === 'error') {
          setStatus('error');
          setMessage(message || 'Failed to process shared content');
        } else {
          // No status parameter, redirect to home
          setLocation('/');
        }
      } catch (error) {
        console.error('Error processing share:', error);
        setStatus('error');
        setMessage('Failed to process shared content');
      }
    };

    processShare();
  }, [setLocation]);

  const handleViewEntry = () => {
    if (entryId) {
      setLocation(`/entry/${entryId}`);
    } else {
      setLocation('/');
    }
  };

  const handleGoHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2">
            {status === 'processing' && (
              <>
                <Loader2 className="animate-spin" size={24} />
                <span>Processing Share...</span>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="text-green-500" size={24} />
                <span>Success!</span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="text-red-500" size={24} />
                <span>Error</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {status === 'processing' && (
            <div className="text-center text-gray-600">
              <Upload className="mx-auto mb-2" size={32} />
              <p>Adding content to your vault...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Button 
                  onClick={handleViewEntry} 
                  className="w-full"
                  disabled={!entryId}
                >
                  View Entry
                </Button>
                <Button 
                  onClick={handleGoHome} 
                  variant="outline" 
                  className="w-full"
                >
                  Go to Home
                </Button>
              </div>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {message}
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={handleGoHome} 
                variant="outline" 
                className="w-full"
              >
                Go to Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}