import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- TYPES ---
export interface TrainingTask {
  id: string;
  name: string; 
  completed: boolean;
}

export interface Associate {
  id: string;
  name: string;
  tasks: TrainingTask[];
  lastSpokenTo?: string; // ISO Date string or undefined
  status: 'active' | 'completed';
}

export interface WorklistItem {
  id: string;
  listId: string;
  imageUri: string;
  description: string;
  completed: boolean;
}

export interface WorklistGroup {
  id: string;
  name: string;
  order: number;
}

export interface DailyPlanGroup {
  title: string;
  data: Array<{
    name: string;
    dayDate: string;
    shiftTime: string;
    endTime24?: number;
  }>;
}

interface AppContextType {
  roster: string[]; 
  trainingQueue: Associate[];
  worklistGroups: WorklistGroup[];
  worklistItems: WorklistItem[];
  dailyPlan: DailyPlanGroup[] | null;
  planTimestamp: string | null;
  // Actions
  addTrainingToAssociate: (name: string, taskNames: string[]) => void;
  removeAssociate: (id: string) => void; 
  markTaskComplete: (associateId: string, taskId: string) => void;
  toggleSpokenStatus: (associateId: string) => void; // <--- RENAMED TO TOGGLE
  addWorklistGroup: (name: string) => void;
  renameWorklistGroup: (id: string, newName: string) => void;
  deleteWorklistGroup: (id: string) => void;
  addWorklistItem: (item: Omit<WorklistItem, 'id' | 'completed'>) => void;
  updateWorklistItem: (id: string, updates: Partial<WorklistItem>) => void;
  deleteWorklistItem: (id: string) => void;
  setDailyPlan: (plan: DailyPlanGroup[] | null, timestamp?: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_ROSTER = [
  "Alejandro Sa", "Alex Ro", "Alexander Mc", "Alexander Ru", "Andrew Er", "Andrew Ga", 
  "Andrew Pr", "Anthony J De", "Aysha Mc", "Barbara Vr", "Benjamin Mc", "Bertilio Nu", 
  "Beth Ma", "Bianca Wa", "Brian C Ba", "Brian Ro", "Brittany Ha", "Bruce Pa", 
  "Burton Wo", "Cassidy Pa", "Chaise Fo", "Cheryl K Sp", "Christian Bu", "Christian Wa", 
  "Cynthia Ke", "Damion Ri", "Damon K AI", "Daniel La", "Danielle Ni", "Danny La", 
  "David Ad", "David Ma", "Deborah Ba", "Derek Du", "DeVon Wi", "Donna Be", 
  "Donna G Do", "Dustin Co", "Earl E Tw", "Eismenia Ma", "Elias Fa", "Eric Fo", 
  "Esther Kr", "Frank Pr", "Fredrick Gr", "Gabriel Ri", "George Mc", "Giselle Pr", 
  "Israel Th", "Izabella Ch", "Jacqueline Pi", "Jacquelyn A Go", "Jamie Du", "Janet Ma", 
  "Jarrett D Si", "Jim Ma", "John G Wa", "John Li", "John Si", "Jose G Ve", "Josh Cr", 
  "Joshua R He", "Jullian Ch", "Kaleigh Le", "Kara Co", "Katherine E De", "Keegan Ca", 
  "Keith Wi", "Latoya Hy", "Leonardo Ba", "Listervelt Hu", "Lois Al", "Makayla Sm", 
  "Marjorie Pe", "Mark Mo", "Martin Ru", "Matthew Bo", "Matthew Mo", "Melissa Al", 
  "Melissa Ca", "Michele L Do", "Mike Wa", "Nathan Ni", "Naza Ha", "Nicholas Bo", 
  "Nicolas Na", "Noreen P Ga", "Richard Ta", "Robert Du", "Ron Ho", "Ronald W Te", 
  "Ryan Hu", "Sean Mc", "Sean Ro", "SEBASTIAN BO", "Shane Me", "Stephen St", 
  "Steven M Ho", "TJ Ha", "Terron Ha", "Terrell Da", "Theodore Wo", "Timothy Wh", 
  "Tonoy Ta", "Victor Pe", "Victoria Ba", "William La", "Willie L FI"
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roster] = useState<string[]>(INITIAL_ROSTER);
  const [trainingQueue, setTrainingQueue] = useState<Associate[]>([]);
  const [worklistGroups, setWorklistGroups] = useState<WorklistGroup[]>([]);
  const [worklistItems, setWorklistItems] = useState<WorklistItem[]>([]);
  const [dailyPlan, setDailyPlanState] = useState<DailyPlanGroup[] | null>(null);
  const [planTimestamp, setPlanTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const savedTraining = await AsyncStorage.getItem('@training_data');
      const savedGroups = await AsyncStorage.getItem('@worklist_groups');
      const savedItems = await AsyncStorage.getItem('@worklist_items');
      const savedPlan = await AsyncStorage.getItem('@daily_plan');
      const savedTime = await AsyncStorage.getItem('@plan_timestamp');
      
      if (savedTraining) setTrainingQueue(JSON.parse(savedTraining));
      if (savedGroups) setWorklistGroups(JSON.parse(savedGroups));
      if (savedItems) setWorklistItems(JSON.parse(savedItems));
      if (savedPlan) setDailyPlanState(JSON.parse(savedPlan));
      if (savedTime) setPlanTimestamp(savedTime);
    };
    loadData();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('@training_data', JSON.stringify(trainingQueue));
    AsyncStorage.setItem('@worklist_groups', JSON.stringify(worklistGroups));
    AsyncStorage.setItem('@worklist_items', JSON.stringify(worklistItems));
    AsyncStorage.setItem('@daily_plan', JSON.stringify(dailyPlan));
    AsyncStorage.setItem('@plan_timestamp', planTimestamp || '');
  }, [trainingQueue, worklistGroups, worklistItems, dailyPlan, planTimestamp]);

  const addTrainingToAssociate = (name: string, taskNames: string[]) => {
    const newTasks: TrainingTask[] = taskNames.map(t => ({
      id: Math.random().toString(36).substr(2, 9),
      name: t,
      completed: false,
    }));
    setTrainingQueue(prev => {
      const existing = prev.find(a => a.name === name);
      if (existing) {
        return prev.map(a => a.name === name 
          ? { ...a, tasks: [...a.tasks, ...newTasks], status: 'active' } 
          : a
        );
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        name,
        tasks: newTasks,
        status: 'active'
      }];
    });
  };

  const removeAssociate = (id: string) => {
    setTrainingQueue(prev => prev.filter(a => a.id !== id));
  };

  const markTaskComplete = (associateId: string, taskId: string) => {
    setTrainingQueue(prev => prev.map(assoc => {
      if (assoc.id !== associateId) return assoc;
      const updatedTasks = assoc.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
      const allDone = updatedTasks.every(t => t.completed);
      return { ...assoc, tasks: updatedTasks, status: allDone ? 'completed' : 'active' };
    }));
  };

  // --- TOGGLE LOGIC ---
  const toggleSpokenStatus = (associateId: string) => {
    setTrainingQueue(prev => prev.map(assoc => {
      if (assoc.id !== associateId) return assoc;
      // If already spoken (has timestamp), clear it. If not, set it.
      const newStatus = assoc.lastSpokenTo ? undefined : new Date().toISOString();
      return { ...assoc, lastSpokenTo: newStatus };
    }));
  };

  const addWorklistGroup = (name: string) => {
    setWorklistGroups([...worklistGroups, { id: Date.now().toString(), name, order: worklistGroups.length }]);
  };

  const renameWorklistGroup = (id: string, newName: string) => {
    setWorklistGroups(prev => prev.map(g => g.id === id ? { ...g, name: newName } : g));
  };

  const deleteWorklistGroup = (id: string) => {
    setWorklistGroups(prev => prev.filter(g => g.id !== id));
    setWorklistItems(prev => prev.filter(i => i.listId !== id));
  };

  const addWorklistItem = (item: Omit<WorklistItem, 'id' | 'completed'>) => {
    setWorklistItems([...worklistItems, { ...item, id: Date.now().toString(), completed: false }]);
  };

  const updateWorklistItem = (id: string, updates: Partial<WorklistItem>) => {
    setWorklistItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteWorklistItem = (id: string) => {
    setWorklistItems(prev => prev.filter(item => item.id !== id));
  };

  const setDailyPlan = (plan: DailyPlanGroup[] | null, timestamp: string | null = null) => {
    setDailyPlanState(plan);
    setPlanTimestamp(timestamp);
  };

  return (
    <AppContext.Provider value={{ 
      roster, trainingQueue, worklistGroups, worklistItems, dailyPlan, planTimestamp,
      addTrainingToAssociate, removeAssociate, markTaskComplete, toggleSpokenStatus,
      addWorklistGroup, renameWorklistGroup, deleteWorklistGroup, 
      addWorklistItem, updateWorklistItem, deleteWorklistItem, setDailyPlan
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};