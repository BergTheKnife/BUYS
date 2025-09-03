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
  Plus
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Vendita, Spesa } from "@shared/schema";

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

interface FinancialHistoryItem {
  id: string;
  azione: string;
  descrizione: string;
  importo: string | null;
  data: string;
}

export default function FinancialManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransfers, setSelectedTransfers] = useState<{
    [member: string]: { [account: string]: number }
  }>({});
  const [transferDescription, setTransferDescription] = useState("");

  // Fetch sales data to calculate balances
  const { data: sales = [], isLoading: salesLoading } = useQuery<Vendita[]>({
    queryKey: ["/api/vendite"],
  });

  // Fetch fund transfers
  const { data: fundTransfers = [], isLoading: transfersLoading } = useQuery<FundTransfer[]>({
    queryKey: ["/api/fund-transfers"],
  });

  // Fetch financial history
  const { data: financialHistory = [], isLoading: historyLoading } = useQuery<FinancialHistoryItem[]>({
    queryKey: ["/api/financial-history"],
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
  });

  // Calculate financial summary from sales data
  const calculateFinancialSummary = (): FinancialSummary => {
    const memberBalances: { [member: string]: MemberBalance } = {};
    const accountTotals: { [account: string]: number } = {};

    // Process sales to calculate initial balances
    sales.forEach(sale => {
      const member = sale.incassatoDa;
      const account = sale.incassatoSu;
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

    // Filter out members with negative or zero total balances and clean up zero accounts
    const cleanedMemberBalances = Object.values(memberBalances)
      .map(memberBalance => ({
        ...memberBalance,
        accounts: Object.fromEntries(
          Object.entries(memberBalance.accounts).filter(([_, amount]) => amount > 0)
        )
      }))
      .filter(mb => mb.total > 0 && Object.keys(mb.accounts).length > 0);

    // Clean up account totals to only show positive balances
    const cleanedAccountTotals = Object.fromEntries(
      Object.entries(accountTotals).filter(([_, amount]) => amount > 0)
    );

    return {
      totalFunds: totalFundsInAccounts + cassaReinvestimento,
      memberBalances: cleanedMemberBalances,
      accountTotals: cleanedAccountTotals,
      cassaReinvestimento
    };
  };

  const financialSummary = calculateFinancialSummary();

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
      for (const [member, accounts] of Object.entries(selectedTransfers)) {
        for (const [account, amount] of Object.entries(accounts)) {
          if (amount > 0) {
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
      queryClient.invalidateQueries({ queryKey: ["/api/fund-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-history"] });
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

      {/* Riunisci Fondi Button */}
      <div className="flex justify-center">
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
                            onChange={(e) => 
                              handleTransferChange(memberBalance.member, account, e.target.value)
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
                  disabled={getTotalTransferAmount() === 0 || transferFunds.isPending}
                  className="flex-1"
                >
                  {transferFunds.isPending ? "Trasferimento..." : "Conferma Trasferimento"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Financial History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Cronologia Azioni Finanziarie
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
              {financialHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.azione}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(item.data)}
                      </span>
                    </div>
                    <p className="text-sm">{item.descrizione}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.importo && (
                      <div className="text-right">
                        <span className="font-medium">
                          {formatCurrency(Number(item.importo))}
                        </span>
                      </div>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteFinancialAction.mutate(item.id)}
                      disabled={deleteFinancialAction.isPending}
                    >
                      Elimina
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}