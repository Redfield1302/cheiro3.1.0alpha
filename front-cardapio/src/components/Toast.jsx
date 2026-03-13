import { useEffect } from "react";
import "./Toast.css";

export const Toast = ({ message, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }
    , [onClose]);
    return (
        <div className="toast">
            {message}
        </div>
    );
}