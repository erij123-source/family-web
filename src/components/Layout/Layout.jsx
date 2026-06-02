import React from 'react';
import Navbar from '../Navbar/Navbar';
import Sidebar from '../Sidebar/Sidebar';
import MobileFooter from '../MobileFooter/MobileFooter';

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <div className="adminuiux-wrap">
        <Sidebar />
        <main
          className="adminuiux-content has-sidebar"
          onClick={() => window.contentClick && window.contentClick()}
        >
          {children}
        </main>
      </div>
      <MobileFooter />
    </>
  );
}

export default Layout;