import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Users,
  CreditCard,
  TrendingUp,
  ArrowRightLeft,
  History,
  Euro,
  Plus,
  ExternalLink,
  Package,
  Receipt,
  Download
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Vendita, Spesa } from "@shared/schema";
import { useLocation } from "wouter";
import { PrelevaCassaModal } from "@/components/modals/preleva-cassa-modal";

// Types for our financial data
interface MemberBalance {
  member: string;
  accounts: { [account: string]: number };
  total: number;
}

interface FinancialSummary {
  totalFunds: number;
  memberBalances: MemberBalance[];
  accountTotals: { [account: string]: number };
  cassaReinvestimento: number;
}

interface FundTransfer {
  id: string;
  fromMember: string;
  fromAccount: string;
  toAccount: string;
  importo: string;
  descrizione: string | null;
  data: string;
}

interface EquityWithdrawal {
  id: string;
  importo: string;
  tipo: string;
  memberId: string | null;
  descrizione: string | null;
  dataOperazione: string;
  annullato: number;
}

interface FinancialHistoryItem {
  id: string;
  azione: string;
  descrizione: string;
  importo: string | null;
  data: string;
}

interface ActivityMember {
  id: string;
  nome: string;
  cognome: string;
}

export default function FinancialManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [showPrelevaCassaModal, setShowPrelevaCassaModal] = useState(false);
  const [selectedTransfers, setSelectedTransfers] = useState<{
    [member: string]: { [account: string]: number }
  }>({});
  const [transferDescription, setTransferDescription] = useState("");
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [addFundsMember, setAddFundsMember] = useState("");
  const [addFundsDescription, setAddFundsDescription] = useState("");

  // Fetch sales data to calculate balances
  const { data: sales = [], isLoading: salesLoading } = useQuery<Vendita[]>({
    queryKey: ["/api/vendite"],
    staleTime: 30 * 1000, // 30 secondi invece di 5 minuti
  });

  // Fetch fund transfers
  const { data: fundTransfers = [], isLoading: transfersLoading } = useQuery<FundTransfer[]>({
    queryKey: ["/api/fund-transfers"],
    staleTime: 30 * 1000, // 30 secondi invece di 5 minuti
  });

  // Fetch financial history
  const { data: financialHistory = [], isLoading: historyLoading } = useQuery<FinancialHistoryItem[]>({
    queryKey: ["/api/financial-history"],
    staleTime: 30 * 1000, // 30 secondi invece di 5 minuti
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch expenses to calculate cassa reinvestimento usage
  const { data: expenses = [] } = useQuery<Spesa[]>({
    queryKey: ["/api/spese"],
  });

  // Fetch cassa reinvestimento balance from API
  const { data: cassaBalance } = useQuery<{ balance: number }>({
    queryKey: ["/api/cassa-reinvestimento-balance"],
    staleTime: 30 * 1000, // 30 secondi invece di 5 minuti
  });

  // Fetch activity members
  const { data: activityMembers = [] } = useQuery<ActivityMember[]>({
    queryKey: ["/api/activity-members"],
    staleTime: 60 * 1000, // 1 minuto
  });

  // Calculate financial summary from sales data
  const calculateFinancialSummary = (): FinancialSummary => {
    const memberBalances: { [member: string]: MemberBalance } = {};
    const accountTotals: { [account: string]: number } = {};

    // Process only sales that have been actually collected (incassato = 1)
    sales
      .filter(sale => sale.incassato === 1 && sale.incassatoDa && sale.incassatoSu)
      .forEach(sale => {
        const member = sale.incassatoDa!;
        const account = sale.incassatoSu!;
        const amount = Number(sale.prezzoVendita);

        if (!memberBalances[member]) {
          memberBalances[member] = {
            member,
            accounts: {},
            total: 0
          };
        }

        memberBalances[member].accounts[account] = (memberBalances[member].accounts[account] || 0) + amount;
        memberBalances[member].total += amount;
        
        accountTotals[account] = (accountTotals[account] || 0) + amount;
      });

    // Subtract fund transfers from member balances
    fundTransfers.forEach(transfer => {
      const fromMember = transfer.fromMember;
      const fromAccount = transfer.fromAccount;
      const amount = Number(transfer.importo);

      // Initialize member and account if they don't exist
      if (!memberBalances[fromMember]) {
        memberBalances[fromMember] = {
          member: fromMember,
          accounts: {},
          total: 0
        };
      }

      // Subtract from member's account balance
      memberBalances[fromMember].accounts[fromAccount] = (memberBalances[fromMember].accounts[fromAccount] || 0) - amount;
      memberBalances[fromMember].total -= amount;
      
      // Update account totals
      accountTotals[fromAccount] = (accountTotals[fromAccount] || 0) - amount;
    });

    // Calculate total funds available in individual accounts (excluding cassa reinvestimento)
    const totalFundsInAccounts = Object.values(accountTotals).reduce((sum, amount) => sum + Math.max(0, amount), 0);
    
    // Use cassa reinvestimento balance from API
    const cassaReinvestimento = cassaBalance?.balance || 0;

    // Include all member balances and accounts (positive and negative) for complete transparency
    const cleanedMemberBalances = Object.values(memberBalances)
      .filter(mb => Object.keys(mb.accounts).length > 0); // Only filter out members with no accounts at all

    // Include all account totals (positive and negative) for consistency
    const cleanedAccountTotals = accountTotals;

    return {
      totalFunds: totalFundsInAccounts + cassaReinvestimento,
      memberBalances: cleanedMemberBalances,
      accountTotals: cleanedAccountTotals,
      cassaReinvestimento
    };
  };

  const financialSummary = calculateFinancialSummary();

  const handleComprehensiveExport = async () => {
    try {
      const response = await apiRequest("GET", "/api/export/financial-history/excel");

      if (!response.ok) {
        throw new Error("Errore nel download del file Excel");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `storico_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Successo",
        description: "Storico completo scaricato con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel download dello storico completo",
        variant: "destructive",
      });
    }
  };

  // Handle transfer amount change
  const handleTransferChange = (member: string, account: string, value: string) => {
    const amount = Number(value) || 0;
    setSelectedTransfers(prev => ({
      ...prev,
      [member]: {
        ...prev[member],
        [account]: amount
      }
    }));
  };

  // Calculate total transfer amount
  const getTotalTransferAmount = (): number => {
    return Object.values(selectedTransfers).reduce((total, memberTransfers) => {
      return total + Object.values(memberTransfers).reduce((sum, amount) => sum + amount, 0);
    }, 0);
  };

  // Determine action type and navigation
  const getActionInfo = (item: FinancialHistoryItem) => {
    if (item.azione === "Riunisci fondi") {
      return {
        canDelete: true,
        page: null,
        pageLabel: null,
        icon: null
      };
    }
    
    // Check if it's an inventory-related action
    if (item.descrizione.includes("Inventario") || 
        item.descrizione.includes("Rifornimento") || 
        item.descrizione.includes("Acquisto:") ||
        item.descrizione.includes("Riduzione inventario")) {
      return {
        canDelete: false,
        page: "/inventario",
        pageLabel: "Magazzino",
        icon: Package
      };
    }
    
    // Check if it's a sale-related action
    if (item.descrizione.includes("Vendita") || item.azione === "Vendita") {
      return {
        canDelete: false,
        page: "/vendite",
        pageLabel: "Vendite",
        icon: Receipt
      };
    }
    
    // Default to expenses page for generic expenses
    return {
      canDelete: false,
      page: "/spese",
      pageLabel: "Spese",
      icon: Receipt
    };
  };

  // Delete financial action
  const deleteFinancialAction = useMutation({
    mutationFn: async (actionId: string) => {
      return await apiRequest("DELETE", `/api/financial-history/${actionId}`);
    },
    onSuccess: () => {
      toast({
        title: "Azione annullata",
        description: "L'azione finanziaria è stata annullata con successo",
      });
      // Invalida tutte le query necessarie per aggiornamento automatico
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fund-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit fund transfer
  const transferFunds = useMutation({
    mutationFn: async () => {
      const transfers = [];
      
      // Validate that no transfer would result in negative balance
      for (const [member, accounts] of Object.entries(selectedTransfers)) {
        for (const [account, amount] of Object.entries(accounts)) {
          if (amount > 0) {
            // Find the available balance for this member and account
            const memberBalance = financialSummary.memberBalances.find(mb => mb.member === member);
            const availableAmount = memberBalance?.accounts[account] || 0;
            
            if (amount > availableAmount) {
              throw new Error(`Importo non valido per ${member} - ${account}: €${amount.toFixed(2)} supera il saldo disponibile di €${availableAmount.toFixed(2)}`);
            }
            
            transfers.push({
              fromMember: member,
              fromAccount: account,
              toAccount: "Cassa Reinvestimento",
              importo: amount.toString(),
              descrizione: transferDescription || null
            });
          }
        }
      }

      if (transfers.length === 0) {
        throw new Error("Seleziona almeno un importo da trasferire");
      }

      return await apiRequest("POST", "/api/fund-transfers", { transfers });
    },
    onSuccess: () => {
      toast({
        title: "Fondi riuniti con successo",
        description: `Trasferiti ${formatCurrency(getTotalTransferAmount())} alla Cassa Reinvestimento`,
      });
      setShowTransferModal(false);
      setSelectedTransfers({});
      setTransferDescription("");
      // Invalida tutte le query necessarie per aggiornamento automatico
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fund-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add personal funds mutation
  const addPersonalFunds = useMutation({
    mutationFn: async () => {
      const amount = Number(addFundsAmount);
      
      if (!addFundsMember.trim()) {
        throw new Error("Inserisci il nome del membro");
      }
      
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Inserisci un importo valido");
      }

      const transfers = [{
        fromMember: addFundsMember,
        fromAccount: "Fondi Personali",
        toAccount: "Cassa Reinvestimento",
        importo: amount.toString(),
        descrizione: addFundsDescription || "Aggiunta fondi personali"
      }];

      return await apiRequest("POST", "/api/fund-transfers", { transfers });
    },
    onSuccess: () => {
      toast({
        title: "Fondi aggiunti con successo",
        description: `Aggiunti ${formatCurrency(Number(addFundsAmount))} alla Cassa Reinvestimento`,
      });
      setShowAddFundsModal(false);
      setAddFundsAmount("");
      setAddFundsMember("");
      setAddFundsDescription("");
      // Invalida tutte le query necessarie per aggiornamento automatico
      queryClient.invalidateQueries({ queryKey: ["/api/vendite"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fund-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cassa-reinvestimento-balance"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (salesLoading || transfersLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Gestione Finanziaria</h1>
        <p className="text-muted-foreground">
          Panoramica completa dei fondi e strumenti di gestione finanziaria
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fondi Totali</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalFunds)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cassa Reinvestimento</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(financialSummary.cassaReinvestimento)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membri Attivi</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialSummary.memberBalances.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conti Attivi</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(financialSummary.accountTotals).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Saldi per Membro
            </CardTitle>
            <CardDescription>
              Distribuzione fondi per ogni membro del team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {financialSummary.memberBalances.map((memberBalance) => (
              <div key={memberBalance.member} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{memberBalance.member}</span>
                  <Badge variant="secondary">
                    {formatCurrency(memberBalance.total)}
                  </Badge>
                </div>
                <div className="pl-4 space-y-1">
                  {Object.entries(memberBalance.accounts).map(([account, amount]) => (
                    <div key={account} className="flex justify-between text-sm text-muted-foreground">
                      <span>{account}</span>
                      <span>{formatCurrency(amount)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Account Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Totali per Conto
            </CardTitle>
            <CardDescription>
              Ammontare totale disponibile per ogni canale di pagamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(financialSummary.accountTotals).map(([account, total]) => (
              <div key={account} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="font-medium">{account}</span>
                <Badge variant="outline" className="text-lg">
                  {formatCurrency(total)}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <span className="font-medium text-green-800 dark:text-green-200">
                Cassa Reinvestimento
              </span>
              <Badge className="bg-green-600 text-white text-lg">
                {formatCurrency(financialSummary.cassaReinvestimento)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pulsante Excel come in vendite */}
      <div className="flex justify-end mb-4">
        <Button onClick={handleComprehensiveExport} variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
          <Download className="h-4 w-4 mr-2" />
          Scarica Storico Completo
        </Button>
      </div>

      {/* Export and Actions */}
      <div className="flex justify-center gap-4">
        <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
          <DialogTrigger asChild>
            <Button size="lg" className="px-8">
              <ArrowRightLeft className="h-5 w-5 mr-2" />
              Riunisci Fondi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Riunisci Fondi in Cassa Reinvestimento</DialogTitle>
              <DialogDescription>
                Seleziona gli importi da trasferire da ciascun membro e conto alla Cassa Reinvestimento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {financialSummary.memberBalances.map((memberBalance) => (
                <div key={memberBalance.member} className="space-y-3">
                  <h4 className="font-medium text-lg">{memberBalance.member}</h4>
                  <div className="pl-4 space-y-2">
                    {Object.entries(memberBalance.accounts).map(([account, availableAmount]) => (
                      <div key={account} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="space-y-1">
                          <span className="font-medium">{account}</span>
                          <p className="text-sm text-muted-foreground">
                            Disponibile: {formatCurrency(availableAmount)}
                          </p>
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            placeholder="0.00"
                            min="0"
                            max={availableAmount}
                            step="0.01"
                            value={selectedTransfers[memberBalance.member]?.[account] || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue = Number(value);
                              
                              // Prevent entering amounts higher than available balance
                              if (value === '' || (numValue >= 0 && numValue <= availableAmount)) {
                                handleTransferChange(memberBalance.member, account, value);
                              }
                            }}
                            className={
                              selectedTransfers[memberBalance.member]?.[account] > availableAmount 
                                ? "border-red-500 focus:border-red-500" 
                                : ""
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {getTotalTransferAmount() > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Totale da trasferire:</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(getTotalTransferAmount())}
                    </span>
                  </div>
                </div>
              )}

              {/* Show warning if any amount exceeds available balance */}
              {Object.entries(selectedTransfers).some(([member, accounts]) => 
                Object.entries(accounts).some(([account, amount]) => {
                  const memberBalance = financialSummary.memberBalances.find(mb => mb.member === member);
                  const availableAmount = memberBalance?.accounts[account] || 0;
                  return amount > availableAmount;
                })
              ) && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 font-medium">⚠️ Attenzione:</span>
                    <span className="text-red-700 dark:text-red-300">
                      Alcuni importi superano i saldi disponibili
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione (opzionale)</Label>
                <Textarea
                  id="description"
                  placeholder="Aggiungi una nota per questo trasferimento..."
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button 
                  onClick={() => transferFunds.mutate()}
                  disabled={
                    getTotalTransferAmount() === 0 || 
                    transferFunds.isPending ||
                    Object.entries(selectedTransfers).some(([member, accounts]) => 
                      Object.entries(accounts).some(([account, amount]) => {
                        const memberBalance = financialSummary.memberBalances.find(mb => mb.member === member);
                        const availableAmount = memberBalance?.accounts[account] || 0;
                        return amount > availableAmount;
                      })
                    )
                  }
                  className="flex-1"
                >
                  {transferFunds.isPending ? "Trasferimento..." : "Conferma Trasferimento"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddFundsModal} onOpenChange={setShowAddFundsModal}>
          <DialogTrigger asChild>
            <Button size="lg" className="px-8" variant="outline" data-testid="button-add-funds">
              <Plus className="h-5 w-5 mr-2" />
              Aggiungi Fondi Personali
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Aggiungi Fondi Personali</DialogTitle>
              <DialogDescription>
                Aggiungi fondi personali direttamente alla Cassa Reinvestimento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member">Membro</Label>
                <Input
                  id="member"
                  type="text"
                  placeholder="Nome del membro..."
                  value={addFundsMember}
                  onChange={(e) => setAddFundsMember(e.target.value)}
                  data-testid="input-add-funds-member"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Importo (€)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  data-testid="input-add-funds-amount"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="funds-description">Descrizione (opzionale)</Label>
                <Textarea
                  id="funds-description"
                  placeholder="Aggiungi una nota..."
                  value={addFundsDescription}
                  onChange={(e) => setAddFundsDescription(e.target.value)}
                  data-testid="input-add-funds-description"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddFundsModal(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button 
                  onClick={() => addPersonalFunds.mutate()}
                  disabled={addPersonalFunds.isPending || !addFundsMember.trim() || !addFundsAmount || Number(addFundsAmount) <= 0}
                  className="flex-1"
                  data-testid="button-confirm-add-funds"
                >
                  {addPersonalFunds.isPending ? "Aggiunta..." : "Aggiungi Fondi"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          size="lg" 
          className="px-8" 
          variant="outline"
          onClick={() => setShowPrelevaCassaModal(true)}
          data-testid="button-preleva-cassa"
        >
          <Euro className="h-5 w-5 mr-2" />
          Preleva da cassa
        </Button>
      </div>

      <PrelevaCassaModal 
        open={showPrelevaCassaModal}
        onOpenChange={setShowPrelevaCassaModal}
        saldoCassa={cassaBalance?.balance || 0}
        membri={activityMembers}
      />

      {/* Financial History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Cronologia Cassa
          </CardTitle>
          <CardDescription>
            Storico di tutti i movimenti e le azioni intraprese
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : financialHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessuna azione registrata ancora
            </p>
          ) : (
            <div className="space-y-3">
              {financialHistory.map((item) => {
                const actionInfo = getActionInfo(item);
                const IconComponent = actionInfo.icon;
                
                return (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Badge variant="secondary" className="w-fit">{item.azione}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(item.data)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{item.descrizione}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      {item.importo && (
                        <div className="text-left sm:text-right min-w-[100px]">
                          <span className="font-bold text-lg text-green-600 dark:text-green-400">
                            {formatCurrency(Number(item.importo))}
                          </span>
                        </div>
                      )}
                      
                      {actionInfo.canDelete ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteFinancialAction.mutate(item.id)}
                          disabled={deleteFinancialAction.isPending}
                          data-testid={`button-delete-${item.id}`}
                          className="w-full sm:w-auto min-w-[100px]"
                        >
                          Elimina
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(actionInfo.page!)}
                          data-testid={`button-goto-${actionInfo.pageLabel?.toLowerCase()}`}
                          className="w-full sm:w-auto min-w-[100px]"
                        >
                          {IconComponent && <IconComponent className="h-4 w-4 mr-1" />}
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {actionInfo.pageLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}