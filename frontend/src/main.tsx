import { App as AntdApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "antd/dist/reset.css";
import "./styles.css";
import App from "./App";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: "#2f7d62",
            colorInfo: "#2f7d62",
            borderRadius: 6,
            fontFamily:
              '"Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif',
          },
          components: {
            Button: { controlHeight: 34 },
            Card: { borderRadiusLG: 8 },
            Layout: {
              bodyBg: "#eef3ef",
              headerBg: "#173f39",
              siderBg: "#f8faf7",
            },
            Tabs: { itemSelectedColor: "#2f7d62" },
          },
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </React.StrictMode>,
  );
}
