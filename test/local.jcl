//U764C   JOB (SYSS,U764,U764),MSGCLASS=X,CLASS=S,NOTIFY=U764, 
//      SYSTEM=SYA                                             
//STEP    EXEC DB2BPLI,                                        
//        SIDX=U764,                                           
//        LIDX=U764,                                           
//        SMBR=FREEZE,                                         
//        LMBR=FREEZE                                          
//LKED.SYSLMOD DD DSN=U764.LINKLIB.PDS(FREEZE),DISP=SHR        
//BIND.SYSTSIN DD *                                            
  DSN SYSTEM(DB2)                                              
      BIND PACKAGE(IRIC0002) -                                 
           MEMBER(FREEZE) -                                    
           ACTION(REP) EXPLAIN(NO) VALIDATE(BIND) ISO(CS)      
  END                                                          
/*