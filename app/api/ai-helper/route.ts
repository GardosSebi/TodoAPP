import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Baza de cunoștințe cu răspunsuri predefinite
const KNOWLEDGE_BASE: Array<{
  keywords: string[]
  response: string
  priority?: number // Prioritate mai mare = mai relevant
}> = [
  {
    keywords: ['cum creez', 'cum adaug', 'creare task', 'nou task', 'adaugă task', 'creez task'],
    response: `Pentru a crea un task nou:
1. Mergi la un proiect din sidebar (sau creează unul nou cu butonul "+")
2. Folosește câmpul "Adaugă o sarcină la acest proiect..." deasupra board-ului Kanban
3. Sau folosește Quick Add Task din partea de sus a paginii
4. Scrie titlul task-ului și apasă Enter sau click pe butonul de adăugare

Poți adăuga și detalii precum termen limită, prioritate sau note după ce task-ul este creat.`
  },
  {
    keywords: ['cum atribui', 'atribuire', 'responsabil', 'asign', 'cine face', 'atribuie'],
    response: `Pentru a atribui un task unui responsabil:
1. Deschide detaliile task-ului (click pe task)
2. Găsește câmpul "Responsabil" în modal
3. Selectează un membru din dropdown
4. Salvează modificările

⚠️ Important: Doar owner-ul workspace-ului poate atribui responsabili la task-uri.`
  },
  {
    keywords: ['template', 'șablon', 'reutilizabil', 'salvează task', 'template-uri'],
    response: `Pentru a crea și folosi template-uri:
1. Mergi la secțiunea "Template" din sidebar
2. Click pe "Template nou" pentru a crea un template
3. Completează detaliile: nume, titlu task, prioritate, subtask-uri, etc.
4. Salvează template-ul

Pentru a folosi un template:
1. Mergi la "Template" din sidebar
2. Click pe "Creează task" la template-ul dorit
3. Selectează proiectul (opțional)
4. Task-ul va fi creat automat cu toate detaliile din template`
  },
  {
    keywords: ['proiect', 'creez proiect', 'nou proiect', 'adaugă proiect', 'creez proiect nou'],
    response: `Pentru a crea un proiect nou:
1. În sidebar, găsește secțiunea "PROIECTE"
2. Click pe iconița "+" de lângă "Proiecte"
3. Scrie numele proiectului
4. Apasă Enter sau click în afara câmpului

Proiectul va apărea în lista de proiecte și poți începe să adaugi task-uri în el.`
  },
  {
    keywords: ['prioritate', 'important', 'urgent', 'prioritize', 'priorități'],
    response: `Pentru a seta prioritatea unui task:
1. Deschide detaliile task-ului
2. Găsește câmpul "Prioritate"
3. Selectează din dropdown:
   - Fără prioritate (implicit)
   - Scăzută
   - Medie
   - Ridicată

Task-urile cu prioritate ridicată apar mai sus în liste și sunt marcate cu culoare roșie.`
  },
  {
    keywords: ['termen', 'deadline', 'dată', 'când', 'până când', 'termen limită'],
    response: `Pentru a seta un termen limită pentru un task:
1. Deschide detaliile task-ului
2. Găsește câmpul "Termen Limită"
3. Click pe iconița de calendar
4. Selectează data dorită
5. Salvează modificările

Task-urile cu termen limită apar în secțiunea "Viitoare" și "Calendar".`
  },
  {
    keywords: ['subtask', 'sub-sarcină', 'subtask-uri', 'pasi', 'subtaskuri'],
    response: `Pentru a adăuga subtask-uri:
1. Deschide detaliile task-ului
2. Găsește secțiunea "Subsarcini"
3. Scrie titlul subtask-ului în câmpul "Adaugă o subsarcină..."
4. Click pe butonul "+" sau apasă Enter
5. Poți marca subtask-urile ca finalizate cu checkbox-ul

Subtask-urile te ajută să împărți un task mare în pași mai mici și mai ușor de gestionat.`
  },
  {
    keywords: ['etichetă', 'tag', 'etichete', 'categorii', 'tag-uri'],
    response: `Pentru a folosi etichete (tag-uri):
1. Deschide detaliile task-ului
2. Găsește secțiunea "Etichete"
3. Selectează o etichetă existentă sau creează una nouă
4. Click pe "+" pentru a adăuga eticheta la task

Etichetele te ajută să organizezi și filtrezi task-urile după categorii. Poți crea etichete noi direct din modalul task-ului.`
  },
  {
    keywords: ['comentariu', 'comentarii', 'discuție', 'note', 'comentează'],
    response: `Pentru a adăuga comentarii la un task:
1. Deschide detaliile task-ului
2. Scroll până la secțiunea "Comentarii"
3. Scrie comentariul în câmpul de text
4. Poți menționa (@mention) alți membri pentru a-i notifica
5. Click pe "Trimite" sau apasă Enter

Comentariile sunt utile pentru discuții și colaborare la task-uri.`
  },
  {
    keywords: ['mențiune', 'mention', '@', 'notifică', 'menționează'],
    response: `Pentru a menționa (@mention) un membru:
1. În câmpul de comentariu, scrie "@" urmat de numele sau email-ul membrului
2. Apare un dropdown cu membrii workspace-ului
3. Selectează membrul dorit
4. Membrul menționat va primi o notificare

Mențiunile funcționează în comentarii și te ajută să atragi atenția membrilor la task-uri importante.`
  },
  {
    keywords: ['filtru', 'filtrează', 'caută', 'căutare', 'găsește', 'filtre'],
    response: `Pentru a filtra și căutare task-uri:
1. În pagina de proiect, găsește bara de căutare deasupra board-ului
2. Scrie în bara de căutare pentru a filtra după titlu sau note
3. Click pe "Filtre Avansate" pentru mai multe opțiuni:
   - Filtrare după prioritate
   - Filtrare după responsabil
   - Filtrare după termen limită
   - Filtrare după etichete

Filtrele te ajută să găsești rapid task-urile de care ai nevoie.`
  },
  {
    keywords: ['finalizează', 'completează', 'gata', 'terminat', 'done', 'finalizat'],
    response: `Pentru a finaliza un task:
1. În board-ul Kanban, trage task-ul în coloana "Finalizat"
2. Sau deschide detaliile task-ului și marchează-l ca finalizat
3. Task-ul va fi mutat automat în secțiunea "Finalizate"

Pentru a finaliza un proiect:
1. Când toate task-urile sunt finalizate, apare butonul "Finalizează Proiectul"
2. Click pe buton pentru a marca proiectul ca finalizat
3. Proiectele finalizate nu mai permit modificări la task-uri`
  },
  {
    keywords: ['arhivează', 'arhivă', 'ascunde', 'șterge', 'arhivare'],
    response: `Pentru a arhiva un task:
1. Deschide detaliile task-ului
2. Click pe meniul de acțiuni (trei puncte)
3. Selectează "Arhivează"
4. Task-ul va fi mutat în secțiunea "Arhivate"

Task-urile arhivate nu mai apar în view-urile principale, dar pot fi accesate din secțiunea "Arhivate" din sidebar.`
  },
  {
    keywords: ['import', 'excel', 'fișier', 'încarcă', 'upload', 'importă'],
    response: `Pentru a importa task-uri din Excel:
1. Mergi la un proiect
2. Click pe butonul "Import Sarcini" deasupra board-ului
3. Selectează fișierul Excel (.xlsx)
4. Verifică datele importate
5. Click pe "Importă" pentru a adăuga task-urile

Formatul Excel trebuie să conțină coloane: Titlu, Termen, Prioritate, Descriere`
  },
  {
    keywords: ['notificări', 'notificare', 'alerta', 'mențiuni', 'notifică'],
    response: `Notificările te ajută să rămâi la curent:
- Primești notificări când ești menționat (@mention) în comentarii
- Primești notificări când ți se atribuie un task
- Primești notificări pentru task-uri apropiate de termen
- Primești notificări pentru task-uri depășite

Poți vedea toate notificările în secțiunea "Primite" din sidebar.`
  },
  {
    keywords: ['membru', 'invită', 'adaugă membru', 'workspace', 'invită membru'],
    response: `Pentru a invita membri în workspace:
1. În sidebar, găsește secțiunea "MEMBRI WORKSPACE"
2. Click pe iconița "+"
3. Introdu email-ul membrului pe care vrei să-l inviți
4. Membrul va primi o invitație și o notificare

⚠️ Doar owner-ul workspace-ului poate invita membri noi.`
  },
  {
    keywords: ['owner', 'proprietar', 'permisiuni', 'drepturi', 'owner workspace'],
    response: `Owner-ul workspace-ului are permisiuni speciale:
- Poate atribui responsabili la task-uri
- Poate invita și elimina membri din workspace
- Poate gestiona setările workspace-ului

Membrii workspace-ului pot:
- Crea și edita task-uri
- Adăuga comentarii și mențiuni
- Vedea toate task-urile din workspace`
  },
  {
    keywords: ['kanban', 'board', 'coloane', 'drag', 'kanban board'],
    response: `Board-ul Kanban organizează task-urile în coloane:
- "Neînceput" - task-uri noi, neîncepute
- "În Progres" - task-uri active
- "Finalizat" - task-uri completate

Poți trage și plasa task-uri între coloane pentru a le muta între stări. Board-ul se actualizează automat.`
  },
  {
    keywords: ['dashboard', 'statistici', 'raport', 'analiză', 'statistică'],
    response: `Dashboard-ul oferă o vedere de ansamblu:
- Statistici despre task-uri (total, finalizate, în progres)
- Grafice cu progresul proiectelor
- Task-uri recente și importante
- Activitate recentă

Accesează Dashboard din sidebar pentru a vedea statistici detaliate.`
  },
  {
    keywords: ['șterge task', 'șterg task', 'elimină task', 'delete task', 'remove task'],
    response: `Pentru a șterge un task:
1. Deschide detaliile task-ului
2. Click pe meniul de acțiuni (trei puncte) sau butonul de ștergere
3. Confirmă ștergerea
4. Task-ul va fi eliminat permanent

⚠️ Atenție: Ștergerea este permanentă și nu poate fi anulată. Dacă vrei doar să ascunzi task-ul, folosește opțiunea de arhivare.`
  },
  {
    keywords: ['duplică', 'copiază', 'duplicate', 'copy task', 'copie task'],
    response: `Pentru a duplica un task:
1. Deschide detaliile task-ului
2. Click pe meniul de acțiuni (trei puncte)
3. Selectează "Duplică" sau "Copiază"
4. Task-ul va fi copiat cu toate detaliile (subtask-uri, etichete, etc.)

Task-ul duplicat va apărea în același proiect și poți modifica detaliile după nevoie.`
  },
  {
    keywords: ['calendar', 'calendariu', 'zi', 'astăzi', 'mâine', 'săptămână'],
    response: `Calendar-ul îți arată task-urile organizate pe zile:
- "Astăzi" - task-uri cu termen limită astăzi
- "Viitoare" - task-uri cu termen limită în viitor
- "Calendar" - vedere calendar completă

Accesează "Calendar" din sidebar pentru a vedea toate task-urile organizate pe zile.`
  },
  {
    keywords: ['fișier', 'atașează', 'upload', 'încarcă fișier', 'document', 'imagine'],
    response: `Pentru a atașa fișiere la un task:
1. Deschide detaliile task-ului
2. Găsește secțiunea "Fișiere și Imagini"
3. Click pe "Încarcă fișier"
4. Selectează fișierul din computer
5. Fișierul va fi atașat la task

Poți atașa imagini, documente și alte tipuri de fișiere. Fișierele sunt salvate și pot fi descărcate oricând.`
  },
  {
    keywords: ['note', 'descriere', 'detalii', 'informații', 'text'],
    response: `Pentru a adăuga note la un task:
1. Deschide detaliile task-ului
2. Găsește câmpul "Note"
3. Scrie detaliile, descrierea sau informațiile necesare
4. Salvează modificările

Notele pot conține text formatat și te ajută să păstrezi toate informațiile importante despre task într-un singur loc.`
  },
  {
    keywords: ['culoare', 'color', 'proiect colorat', 'schimbă culoare'],
    response: `Pentru a schimba culoarea unui proiect:
1. Proiectele pot avea culori personalizate pentru organizare vizuală
2. Culoarea apare lângă iconița proiectului în sidebar
3. Poți seta culoarea la crearea proiectului sau din setări

Culorile te ajută să diferențiezi rapid proiectele în sidebar și în board-uri.`
  },
  {
    keywords: ['repornește', 'reopen', 'deschide din nou', 'reactivare'],
    response: `Pentru a reporni un proiect finalizat:
1. Mergi la proiectul finalizat
2. Vei vedea butonul "Repornește Proiectul" în header
3. Click pe buton pentru a reactiva proiectul
4. Proiectul va reveni la starea activă și poți modifica task-urile din nou

⚠️ Doar owner-ul proiectului poate reporni un proiect finalizat.`
  },
  {
    keywords: ['activitate', 'istoric', 'log', 'ce s-a întâmplat', 'modificări'],
    response: `Istoricul activităților arată:
- Când au fost create task-uri
- Când au fost modificate task-uri
- Când au fost adăugate comentarii
- Când au fost finalizate task-uri

Poți vedea activitatea recentă în Dashboard sau în secțiunea de activități a fiecărui proiect.`
  },
  {
    keywords: ['statistici', 'raport', 'progres', 'număr task', 'câte task'],
    response: `Pentru a vedea statistici:
1. Accesează "Dashboard" din sidebar
2. Vei vedea:
   - Numărul total de task-uri
   - Task-uri finalizate vs active
   - Progresul proiectelor
   - Grafice cu activitatea

Statisticile te ajută să vezi progresul general și să identifici proiectele care necesită atenție.`
  },
  {
    keywords: ['mobil', 'telefon', 'phone', 'tabletă', 'responsive'],
    response: `Aplicația este complet responsive și funcționează pe:
- Desktop și laptop
- Tablete
- Telefoane mobile

Toate funcționalitățile sunt disponibile pe toate dispozitivele. Pe mobile, sidebar-ul se transformă într-un meniu mobil accesibil prin butonul de meniu.`
  },
  {
    keywords: ['dark mode', 'mod întunecat', 'tema', 'theme', 'culoare'],
    response: `Pentru a schimba tema (light/dark mode):
1. În sidebar, găsește butonul cu iconița de soare/lună în partea de jos
2. Click pe buton pentru a comuta între modul light și dark
3. Preferința ta va fi salvată automat

Modul dark este mai ușor pentru ochi, mai ales când lucrezi în condiții de lumină slabă.`
  },
  {
    keywords: ['setări', 'settings', 'configurare', 'preferințe'],
    response: `Pentru a accesa setările:
1. Click pe iconița de setări (roata dințată) din sidebar
2. Vei ajunge la pagina de setări unde poți:
   - Modifica profilul
   - Schimba preferințele
   - Gestiona contul

Setările te ajută să personalizezi experiența ta în aplicație.`
  },
  {
    keywords: ['logout', 'ieșire', 'deconectare', 'sign out'],
    response: `Pentru a ieși din cont:
1. În sidebar, găsește butonul de logout (săgeată care iese din cutie) în partea de jos
2. Click pe buton
3. Vei fi deconectat și redirecționat la pagina de login

Poți reveni oricând și să te conectezi din nou cu același cont.`
  },
  {
    keywords: ['invitație', 'invită', 'acceptă invitație', 'respinge invitație'],
    response: `Pentru a gestiona invitațiile workspace:
1. Mergi la secțiunea "Primite" din sidebar
2. Vei vedea invitațiile primite în secțiunea "Invitații Workspace"
3. Click pe "Acceptă" pentru a te alătura workspace-ului
4. Sau "Respinge" pentru a refuza invitația

După acceptare, vei avea acces la toate proiectele și task-urile din acel workspace.`
  },
  {
    keywords: ['caută', 'search', 'găsește task', 'căutare globală'],
    response: `Pentru a căuta task-uri:
1. Folosește bara de căutare din partea de sus a paginii
2. Scrie cuvinte cheie din titlul sau notele task-ului
3. Rezultatele vor apărea în timp real
4. Click pe un rezultat pentru a deschide task-ul

Căutarea funcționează în toate proiectele și workspace-urile tale.`
  },
  {
    keywords: ['sortare', 'sortează', 'ordonează', 'organizează'],
    response: `Task-urile sunt sortate automat după:
- Prioritate (ridicată → scăzută)
- Termen limită (cele mai apropiate primul)
- Data creării (cele mai recente primul)

Poți folosi filtrele avansate pentru a organiza task-urile după preferințele tale.`
  },
  {
    keywords: ['progres', 'status', 'stare', 'stadiu', 'unde sunt'],
    response: `Task-urile pot fi în următoarele stări:
- Neînceput - task-uri noi, neîncepute
- În Progres - task-uri active pe care lucrezi
- Finalizat - task-uri completate

Poți muta task-uri între stări prin drag & drop în board-ul Kanban sau din modalul de detalii.`
  },
  {
    keywords: ['colaborare', 'echipă', 'team', 'lucru în echipă'],
    response: `Pentru colaborare în echipă:
1. Invită membri în workspace (doar owner poate)
2. Atribuie task-uri membrilor echipei
3. Folosește mențiuni (@mention) în comentarii pentru a notifica membrii
4. Toți membrii pot vedea și edita task-urile din workspace

Colaborarea este esențială pentru proiecte mai mari cu mai mulți membri.`
  },
  {
    keywords: ['securitate', 'privat', 'date', 'confidențial'],
    response: `Aplicația respectă securitatea datelor:
- Fiecare utilizator vede doar task-urile și proiectele din workspace-urile sale
- Datele sunt izolate între workspace-uri
- Parolele sunt hash-uite cu Argon2
- Sesiunile sunt securizate prin NextAuth

Datele tale sunt private și accesibile doar de tine și membrii workspace-urilor tale.`
  },
  {
    keywords: ['eroare', 'problemă', 'nu funcționează', 'bug', 'ajutor'],
    response: `Dacă întâmpini probleme:
1. Verifică dacă ești conectat la internet
2. Reîncarcă pagina (F5 sau Ctrl+R)
3. Verifică dacă ai permisiunile necesare (owner vs membru)
4. Asigură-te că folosești un browser actualizat

Dacă problema persistă, poți:
- Șterge cache-ul browser-ului
- Încearcă în modul incognito
- Verifică consola browser-ului pentru erori`
  },
  {
    keywords: ['tastatură', 'scurtături', 'keyboard', 'shortcuts', 'hotkeys'],
    response: `Scurtături disponibile:
- Enter - trimite mesaj în chat sau salvează task
- Escape - închide modaluri
- Click drag - mută task-uri în Kanban board
- Click - deschide detalii task

Majoritatea acțiunilor pot fi făcute cu mouse-ul, dar poți folosi și tastatura pentru o navigare mai rapidă.`
  },
  {
    keywords: ['export', 'descarcă', 'download', 'raport', 'excel'],
    response: `Pentru a exporta date:
- Poți importa task-uri din Excel
- Datele tale sunt salvate în baza de date și pot fi accesate oricând
- Pentru backup, datele sunt stocate în PostgreSQL

Funcționalitatea de export complet va fi disponibilă în versiuni viitoare.`
  },
  {
    keywords: ['salut', 'bună', 'hello', 'hi', 'ajutor', 'help', 'ce poți', 'ce faci', 'start', 'început'],
    response: `Bună! Sunt asistentul tău pentru această aplicație de gestionare task-uri. 

Pot să te ajut cu:
- Crearea și gestionarea task-urilor și proiectelor
- Folosirea template-urilor pentru task-uri reutilizabile
- Atribuirea responsabililor la task-uri
- Filtrarea și organizarea task-urilor
- Adăugarea comentariilor și mențiunilor
- Gestionarea workspace-urilor și membrilor
- Și multe altele!

Întreabă-mă orice despre aplicație și te voi ajuta! 😊

Poți întreba despre: cum creezi task-uri, cum atribui responsabili, cum folosești template-uri, filtre, comentarii, notificări și multe altele!`
  },
  {
    keywords: ['mulțumesc', 'mersi', 'thanks', 'thank you', 'apreciat'],
    response: `Cu plăcere! 😊

Dacă mai ai întrebări sau ai nevoie de ajutor, sunt aici pentru tine. Succes cu gestionarea task-urilor tale!`
  }
]

// Funcție pentru a găsi cel mai bun răspuns bazat pe întrebare
function findBestResponse(question: string): string {
  const questionLower = question.toLowerCase().trim()
  
  // Cuvinte stop care nu sunt relevante pentru căutare
  const stopWords = ['cum', 'ce', 'unde', 'când', 'de', 'la', 'în', 'pe', 'cu', 'pentru', 'să', 'un', 'o', 'este', 'sunt']
  
  // Extrage cuvinte cheie din întrebare (elimină stop words)
  const questionWords = questionLower
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
  
  let bestMatch = null
  let maxScore = 0
  
  for (const entry of KNOWLEDGE_BASE) {
    let score = 0
    
    // Verifică fiecare cuvânt cheie
    for (const keyword of entry.keywords) {
      const keywordLower = keyword.toLowerCase()
      
      // Potrivire exactă - scor mai mare
      if (questionLower === keywordLower || questionLower.includes(keywordLower)) {
        score += 3
      }
      
      // Potrivire parțială - scor mediu
      if (questionLower.includes(keywordLower) || keywordLower.includes(questionLower)) {
        score += 2
      }
      
      // Verifică dacă cuvintele din întrebare conțin keyword-ul
      for (const word of questionWords) {
        if (keywordLower.includes(word) || word.includes(keywordLower)) {
          score += 1
        }
      }
    }
    
    // Bonus pentru prioritate dacă există
    if (entry.priority) {
      score += entry.priority
    }
    
    // Bonus pentru numărul de keyword-uri potrivite
    const matchedKeywords = entry.keywords.filter(k => 
      questionLower.includes(k.toLowerCase())
    ).length
    score += matchedKeywords * 0.5
    
    if (score > maxScore) {
      maxScore = score
      bestMatch = entry
    }
  }
  
  // Dacă găsește un match cu scor minim de 2, returnează răspunsul
  if (bestMatch && maxScore >= 2) {
    return bestMatch.response
  }
  
  // Dacă nu găsește nimic, caută în răspunsurile existente pentru sugestii
  const suggestions = [
    'cum să creezi task-uri',
    'cum să atribui responsabili',
    'cum să folosești template-uri',
    'cum să filtrezi task-uri',
    'cum să adaugi comentarii',
    'cum să finalizezi task-uri',
    'cum să gestionezi proiectele',
    'cum să inviți membri în workspace'
  ]
  
  // Răspuns default cu sugestii
  return `Îmi pare rău, nu am găsit un răspuns exact pentru întrebarea ta. 

Încearcă să reformulezi întrebarea sau întreabă despre:
${suggestions.map(s => `- ${s}`).join('\n')}

Poți și să explici mai detaliat ce vrei să faci sau ce funcționalitate cauți, și te voi ajuta! 😊`
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Obține ultimul mesaj (întrebarea utilizatorului)
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }

    // Simulează un delay pentru a părea mai natural (500ms)
    await new Promise(resolve => setTimeout(resolve, 500))

    // Găsește cel mai bun răspuns
    const response = findBestResponse(lastMessage.content)

    return NextResponse.json({ response })
  } catch (error: any) {
    console.error('AI Helper Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
