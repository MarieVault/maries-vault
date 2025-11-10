import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Share, 
  Plus, 
  Home, 
  Smartphone, 
  Camera, 
  ExternalLink, 
  Info,
  ChevronRight,
  CheckCircle
} from 'lucide-react';

export default function InstallPWA() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);

  const steps = [
    {
      title: "Open Safari",
      description: "Open this website in Safari on your iPhone",
      icon: <Smartphone className="w-5 h-5" />,
      detail: "Make sure you're using Safari, not Chrome or other browsers"
    },
    {
      title: "Tap Share Button",
      description: "Tap the share button at the bottom of Safari",
      icon: <Share className="w-5 h-5" />,
      detail: "Look for the square with an arrow pointing up"
    },
    {
      title: "Add to Home Screen",
      description: "Scroll down and tap 'Add to Home Screen'",
      icon: <Plus className="w-5 h-5" />,
      detail: "You may need to scroll down to find this option"
    },
    {
      title: "Confirm Installation",
      description: "Tap 'Add' in the top right corner",
      icon: <Home className="w-5 h-5" />,
      detail: "The app will now appear on your home screen"
    }
  ];

  const features = [
    {
      icon: <Camera className="w-5 h-5 text-blue-500" />,
      title: "Share Photos Directly",
      description: "Share images from any app straight to your vault"
    },
    {
      icon: <ExternalLink className="w-5 h-5 text-green-500" />,
      title: "Share Links",
      description: "Share links from Safari or other browsers"
    },
    {
      icon: <Home className="w-5 h-5 text-purple-500" />,
      title: "Home Screen Access",
      description: "Quick access from your iPhone home screen"
    }
  ];

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const checkInstallation = () => {
    // Check if running as PWA
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isPWA);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Smartphone className="w-6 h-6" />
              <span>Install Marie's Vault</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Install Marie's Vault as a PWA to share photos and links directly from your iPhone!
            </p>
            
            <Button onClick={checkInstallation} className="w-full mb-4">
              Check Installation Status
            </Button>
            
            {isInstalled && (
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ Marie's Vault is installed! You can now share content directly from other apps.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What You'll Get</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3">
                  {feature.icon}
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Installation Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    currentStep === index 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleStepClick(index)}
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant={currentStep === index ? "default" : "outline"}>
                      {index + 1}
                    </Badge>
                    {step.icon}
                    <div className="flex-1">
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  
                  {currentStep === index && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-700">{step.detail}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="w-5 h-5" />
              <span>How to Use</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900">Sharing Photos</h4>
                <p className="text-sm text-blue-800">
                  From any app: Tap share → Select "Marie's Vault" → Your photo will be added automatically
                </p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900">Sharing Links</h4>
                <p className="text-sm text-green-800">
                  From Safari: Tap share → Select "Marie's Vault" → The link will be saved to your vault
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}