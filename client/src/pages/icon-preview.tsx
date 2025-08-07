import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Smartphone, Monitor, Download } from "lucide-react";
import { Link } from "wouter";

export default function IconPreview() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna alla Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Anteprima Icona App</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* iPhone Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Anteprima iPhone
              </CardTitle>
              <CardDescription>
                Come apparirà l'icona sulla home screen del tuo iPhone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl p-8 text-center">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {/* Other app icons simulation */}
                  <div className="bg-white/20 rounded-2xl aspect-square flex items-center justify-center text-white text-xs">
                    App
                  </div>
                  <div className="bg-white/20 rounded-2xl aspect-square flex items-center justify-center text-white text-xs">
                    App
                  </div>
                  
                  {/* BUYS App Icon */}
                  <div className="bg-white rounded-2xl aspect-square flex items-center justify-center shadow-lg relative overflow-hidden">
                    <img 
                      src="/app-icon.png" 
                      alt="BUYS App Icon" 
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  </div>
                  
                  <div className="bg-white/20 rounded-2xl aspect-square flex items-center justify-center text-white text-xs">
                    App
                  </div>
                </div>
                
                {/* App name under icon */}
                <div className="text-center">
                  <div className="bg-white rounded-2xl aspect-square w-16 h-16 mx-auto mb-2 flex items-center justify-center shadow-lg overflow-hidden">
                    <img 
                      src="/app-icon.png" 
                      alt="BUYS" 
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  </div>
                  <p className="text-white text-sm font-medium">BUYS</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Browser Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Anteprima Browser
              </CardTitle>
              <CardDescription>
                Come apparirà l'icona nel browser e nei bookmark
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 rounded-lg p-4">
                {/* Browser tab simulation */}
                <div className="bg-white rounded-t-lg p-3 mb-4 shadow-sm border">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/app-icon.png" 
                      alt="BUYS Favicon" 
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium">BUYS - Build Up Your Store</span>
                  </div>
                </div>

                {/* App icon large view */}
                <div className="text-center">
                  <div className="bg-white rounded-3xl w-32 h-32 mx-auto mb-4 shadow-lg flex items-center justify-center overflow-hidden">
                    <img 
                      src="/app-icon.png" 
                      alt="BUYS Logo" 
                      className="w-full h-full object-cover rounded-3xl"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">BUYS</h3>
                  <p className="text-sm text-gray-600">Build Up Your Store</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Come Aggiungere alla Home Screen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Su iPhone/iPad:</h4>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Apri l'app nel browser Safari</li>
                  <li>Tocca il pulsante "Condividi" (quadrato con freccia verso l'alto)</li>
                  <li>Scorri e seleziona "Aggiungi alla schermata Home"</li>
                  <li>Conferma il nome "BUYS" e tocca "Aggiungi"</li>
                </ol>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Su Android:</h4>
                <ol className="list-decimal list-inside space-y-1 text-green-800">
                  <li>Apri l'app nel browser Chrome</li>
                  <li>Tocca il menu (tre puntini in alto a destra)</li>
                  <li>Seleziona "Aggiungi alla schermata Home"</li>
                  <li>Conferma il nome "BUYS" e tocca "Aggiungi"</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}