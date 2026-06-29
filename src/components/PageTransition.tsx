import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const PageTransition = ({ children, className }: PageTransitionProps) => (
  <div className={className}>
    {children}
  </div>
);

export default PageTransition;
