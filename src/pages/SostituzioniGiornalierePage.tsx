import { useRef, useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Printer, Trash2, Send } from 'lucide-react';
import { formatLocalDate, getTimeRange, SPECIAL_REPLACEMENT_OPTIONS } from '../utils/scheduleUtils';
import { useToast } from '../hooks/use-toast';

// Funzione per leggere la data dalla query string
function getQueryDate(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('date');
}

export const SostituzioniGiornalierePage = () => {
  const { teachers, replacements, deleteReplacement } = useData();
  const [selectedDate, setSelectedDate] = useState<string>(formatLocalDate(new Date()));
  const [tableId, setTableId] = useState<string>('64');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Imposta la data dalla query se esiste
  useEffect(() => {
    const qDate = getQueryDate();
    if (qDate) {
      setSelectedDate(qDate);
    }
  }, []);

  const dailyReplacements = replacements.filter(r => r.date === selectedDate);

  const getTeacherName = (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    return teacher ? teacher.name : 'Docente non trovato';
  };

  // Funzione per formattare la visualizzazione della classe
  const formatClassName = (replacement: any) => {
    const absentTeacher = teachers.find(t => t.id === replacement.absentTeacherId);
    if (absentTeacher) {
      const date = new Date(replacement.date);
      const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
      const day = dayNames[date.getDay()];
      const originalClass = absentTeacher.schedule[day]?.[replacement.hour];
      if (originalClass) {
        return originalClass;
      }
    }
    if (SPECIAL_REPLACEMENT_OPTIONS.includes(replacement.className)) {
      return " ";
    }
    return replacement.className;
  };

  // Funzione per visualizzare il nome del docente sostituto con l'indicazione del recupero permesso
  const formatReplacementTeacherDisplay = (replacement: any) => {
    if (!replacement.replacementTeacherId) {
      return replacement.className;
    }
    const teacherName = getTeacherName(replacement.replacementTeacherId);
    if (replacement.className === "Recupero permesso") {
      return `${teacherName} (Per. Rec.)`;
    }
    return teacherName;
  };

  // Invio diretto a TablePress su WordPress
  const handlePublishToWordPress = async () => {
    if (dailyReplacements.length === 0) {
      toast({
        title: "Nessun dato da inviare",
        description: "Non ci sono sostituzioni registrate per la data selezionata.",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm(`Vuoi inviare le ${dailyReplacements.length} sostituzioni del ${selectedDate} alla tabella TablePress ID ${tableId}?`)) {
      return;
    }

    setIsPublishing(true);
    try {
      // Prepara le sostituzioni risolte con la classe effettiva
      const preparedReplacements = dailyReplacements.map(rep => ({
        ...rep,
        resolvedClass: formatClassName(rep).trim() || rep.className
      }));

      const response = await fetch("https://roncalliweb.edu.it", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Roncalli-Key": "RONCALLI_2026_API_KEY"
        },
        body: JSON.stringify({
          table_id: tableId.trim() || "64",
          date: selectedDate,
          teachers: teachers,
          replacements: preparedReplacements
        })
      });

      const res = await response.json();
      if (res.ok) {
        toast({
          title: "Pubblicato su WordPress!",
          description: res.msg,
        });
      } else {
        toast({
          title: "Errore WordPress",
          description: res.msg || "Impossibile aggiornare la tabella.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Errore di connessione",
        description: err.message || "Verifica che lo Snippet 10 sia attivo su WordPress.",
        variant: "destructive"
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePrint = () => {
    if (tableRef.current) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Il blocco popup è attivo. Abilita i popup per utilizzare questa funzione.');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Sostituzioni del ${selectedDate}</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { text-align: center; }
            </style>
          </head>
          <body>
            <h1>Sostituzioni del ${selectedDate}</h1>
            ${tableRef.current.outerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  const handleDeleteReplacement = (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa sostituzione?')) {
      deleteReplacement(id);
      toast({
        title: "Sostituzione eliminata",
        description: "La sostituzione è stata eliminata con successo.",
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sostituzioni Giornaliere</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="date" className="block text-gray-700 mb-2 font-medium">
                Seleziona Data:
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="tableId" className="block text-gray-700 mb-2 font-medium">
                ID Tabella WP:
              </label>
              <input
                type="text"
                id="tableId"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-20 p-2 border border-gray-300 rounded text-center font-bold focus:outline-none focus:ring-2 focus:ring-green-600"
                title="ID della tabella TablePress su WordPress (es. 64)"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handlePublishToWordPress}
              disabled={isPublishing}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {isPublishing ? 'Invio in corso...' : 'Pubblica su WordPress'}
            </Button>

            <Button 
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Stampa
            </Button>
          </div>
        </div>

        <div ref={tableRef}>
          <Table>
            <TableCaption>Sostituzioni per il giorno {selectedDate}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Ora</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Docente Assente</TableHead>
                <TableHead>Docente Sostituto</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyReplacements.length > 0 ? (
                dailyReplacements.map((replacement) => (
                  <TableRow key={replacement.id}>
                    <TableCell>{getTimeRange(replacement.hour)}</TableCell>
                    <TableCell>{formatClassName(replacement)}</TableCell>
                    <TableCell>{getTeacherName(replacement.absentTeacherId)}</TableCell>
                    <TableCell>
                      {formatReplacementTeacherDisplay(replacement)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteReplacement(replacement.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6">
                    Nessuna sostituzione registrata per questa data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
